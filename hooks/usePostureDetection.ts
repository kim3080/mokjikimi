"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// MediaPipe Landmark 및 분석 결과 타입 정의
export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
  presence?: number;
}

export interface PostureMetrics {
  shoulderBalance: number;       // 좌우 어깨 수평도 편차 (0에 가까울수록 이상적)
  neckVerticalDistance: number;     // 양쪽 귀와 양쪽 어깨 간의 Y축 거리 평균
  normalizedEarShoulderY: number;   // 어깨 너비로 정규화된 귀-어깨 수직 비율 (원근 왜곡 방지용)
  zDepthOffset: number;             // 어깨 대비 귀의 전방 Z축 쏠림값 (카메라 쪽으로 돌출된 깊이)
  postureScore: number;          // 100점 만점의 자세 점수
  status: "perfect" | "warning" | "danger"; // 실시간 자세 분석 등급
}

interface UsePostureDetectionReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  landmarks: Landmark[] | null;
  metrics: PostureMetrics | null;
  isModelLoading: boolean;
  isDetecting: boolean;
  isSlouching: boolean; // 거북목(구부정함) 최종 감지 여부
  isCalibrated: boolean;
  snapshotUrl: string | null;
  error: string | null;
  startDetection: () => Promise<void>;
  stopDetection: () => void;
  toggleDetection: () => void;
  calibrate: () => boolean;
  captureSnapshot: () => string | null;
}

export function usePostureDetection(): UsePostureDetectionReturn {
  // HTML 엘리먼트 참조를 위한 Ref
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // 미디어 스트림 및 분석 루프 관리 Ref
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const poseLandmarkerRef = useRef<any | null>(null); // MediaPipe PoseLandmarker 인스턴스
  
  // 캔버스 오버레이 마스크 필터 이미지 캐싱 Ref
  const filterImageRef = useRef<HTMLImageElement | null>(null);

  // 상태 관리
  const [landmarks, setLandmarks] = useState<Landmark[] | null>(null);
  const [metrics, setMetrics] = useState<PostureMetrics | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isSlouching, setIsSlouching] = useState(false); // 거북목 상태
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 개인별 바른 자세 기준치 (영점 조절)
  const baselineRef = useRef<{
    normalizedEarShoulderY: number;
    zDepthOffset: number;
  } | null>(null);

  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);

  // 영점 등록 함수
  const calibrate = useCallback((): boolean => {
    if (!landmarks || landmarks.length < 13) return false;
    const leftEar = landmarks[7];
    const rightEar = landmarks[8];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    if (!leftEar || !rightEar || !leftShoulder || !rightShoulder) return false;

    const shoulderWidth = Math.sqrt(
      Math.pow(leftShoulder.x - rightShoulder.x, 2) +
      Math.pow(leftShoulder.y - rightShoulder.y, 2)
    );
    const leftEarShoulderY = leftShoulder.y - leftEar.y;
    const rightEarShoulderY = rightShoulder.y - rightEar.y;
    const neckVerticalDistance = (leftEarShoulderY + rightEarShoulderY) / 2;
    const normalizedEarShoulderY = neckVerticalDistance / (shoulderWidth || 1);

    const avgEarZ = (leftEar.z + rightEar.z) / 2;
    const avgShoulderZ = (leftShoulder.z + rightShoulder.z) / 2;
    const zDepthOffset = avgShoulderZ - avgEarZ;

    baselineRef.current = {
      normalizedEarShoulderY,
      zDepthOffset,
    };
    setIsCalibrated(true);
    return true;
  }, [landmarks]);

  // ----------------------------------------------------
  // 1. 컴포넌트 마운트 시 필터용 이미지 사전에 로드
  // ----------------------------------------------------
  useEffect(() => {
    const img = new Image();
    img.src = "/filter.png";
    img.onload = () => {
      filterImageRef.current = img;
    };
    img.onerror = () => {
      // 이미지 미배치 상태일 때는 Canvas 수동 벡터 오버레이 작동
      filterImageRef.current = null;
    };
  }, []);

  // ----------------------------------------------------
  // 2. MediaPipe PoseLandmarker 비동기 로드 및 초기화
  // ----------------------------------------------------
  const initPoseLandmarker = async () => {
    if (poseLandmarkerRef.current) return poseLandmarkerRef.current;

    setIsModelLoading(true);
    setError(null);

    try {
      // SSR 방지 동적 임포트
      const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");

      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm"
      );

      const modelAssetPath = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

      let landmarker: any;
      try {
        landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
        });
      } catch (gpuErr) {
        console.warn("GPU 가속 모드 실패, CPU 모드로 대체 전환합니다:", gpuErr);
        landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath,
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
        });
      }

      poseLandmarkerRef.current = landmarker;
      setIsModelLoading(false);
      return landmarker;
    } catch (err: any) {
      console.error("MediaPipe PoseLandmarker 로드 실패:", err);
      setError("AI 분석 모델 초기화에 실패했습니다. 네트워크 연결을 확인하세요.");
      setIsModelLoading(false);
      throw err;
    }
  };

  // ----------------------------------------------------
  // 3. 실시간 프레임 분석 가이드 및 랜드마크 추출 루프
  // ----------------------------------------------------
  const startDetectionLoop = useCallback((landmarker: any) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastVideoTime = -1;

    const renderLoop = () => {
      if (!video || video.paused || video.ended) {
        animationFrameId.current = requestAnimationFrame(renderLoop);
        return;
      }

      // 비디오 해상도 정밀 동기화
      if (video.videoWidth > 0 && (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight)) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const timestamp = performance.now();
      if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;

        try {
          const result = landmarker.detectForVideo(video, timestamp);

          if (result && result.landmarks && result.landmarks.length > 0) {
            const currentLandmarks = result.landmarks[0] as Landmark[];
            setLandmarks(currentLandmarks);

            // 랜드마크 수학 연산 및 거북목 판정 수행
            const calculatedMetrics = analyzePosture(currentLandmarks);
            
            // 캔버스 위에 골격 뼈대 및 어깨 수평선, 슬라우칭 필터 실시간 렌더링
            if (calculatedMetrics) {
              drawLandmarksAndFilter(ctx, canvas.width, canvas.height, currentLandmarks, calculatedMetrics);
            }
          } else {
            // 사람이 감지되지 않는 경우 화면 청소 및 상태 초기화
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
        } catch (err) {
          console.error("분석 중 실시간 프레임 에러:", err);
        }
      }

      animationFrameId.current = requestAnimationFrame(renderLoop);
    };

    animationFrameId.current = requestAnimationFrame(renderLoop);
  }, []);

  // ----------------------------------------------------
  // 4. 거북목 정밀 판별 기하학 알고리즘 (Y축 & Z축 분석)
  // ----------------------------------------------------
  const analyzePosture = (landmarks: Landmark[]): PostureMetrics | null => {
    // 랜드마크 맵핑
    // Nose: 0, Left Eye: 2, Right Eye: 5, Left Ear: 7, Right Ear: 8, Left Shoulder: 11, Right Shoulder: 12
    const leftEar = landmarks[7];
    const rightEar = landmarks[8];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];

    const minVisibility = 0.5;
    const isVisible =
      leftEar && rightEar && leftShoulder && rightShoulder &&
      (leftEar.visibility ?? 1) > minVisibility &&
      (rightEar.visibility ?? 1) > minVisibility &&
      (leftShoulder.visibility ?? 1) > minVisibility &&
      (rightShoulder.visibility ?? 1) > minVisibility;

    if (!isVisible) return null;

    // ------------------------------------------------------------
    // [수학적 알고리즘 1] 원근 스케일 왜곡 방지용 어깨 폭 정규화
    // 사용자가 카메라에 가까이 오면 거리가 넓어지고 멀어지면 좁아집니다.
    // 이를 보정하기 위해 양 어깨의 Euclidean 거리를 구해 스케일 척도(Shoulder Width)로 지정합니다.
    // ------------------------------------------------------------
    const shoulderWidth = Math.sqrt(
      Math.pow(leftShoulder.x - rightShoulder.x, 2) +
      Math.pow(leftShoulder.y - rightShoulder.y, 2)
    );

    // 1) 좌우 어깨 수평 편차 (Shoulder Balance) - 작을수록 대칭
    const shoulderBalance = Math.abs(leftShoulder.y - rightShoulder.y);

    // 2) 귀와 어깨 간의 Y축 절대적 수직 거리 (Neck Vertical Distance)
    const leftEarShoulderY = leftShoulder.y - leftEar.y;
    const rightEarShoulderY = rightShoulder.y - rightEar.y;
    const neckVerticalDistance = (leftEarShoulderY + rightEarShoulderY) / 2;

    // ------------------------------------------------------------
    // [수학적 알고리즘 2] 어깨 너비 기반 귀-어깨 수직 거리 비 (normalizedEarShoulderY)
    // 어깨 폭에 비해 귀-어깨의 수직 높이 차이가 좁아진다는 것은 머리가 아래로 꺼졌음을 의미합니다.
    // 정밀한 거북목 판별을 위해 '귀-어깨 Y간격 / 어깨 너비' 비율을 산출합니다. (원근 강건형)
    // ------------------------------------------------------------
    const normalizedEarShoulderY = neckVerticalDistance / (shoulderWidth || 1);

    // ------------------------------------------------------------
    // [수학적 알고리즘 3] Z축 깊이(Depth) 기반 목의 전방 돌출 감지 (zDepthOffset)
    // MediaPipe의 Z 좌표는 엉덩이 기준 카메라 방향으로의 '상대 깊이'입니다.
    // 귀의 Z좌표가 어깨의 Z좌표보다 월등히 더 가깝다면(더 작은 음수값) 머리가 앞으로 튀어나온 상태입니다.
    // 계산식: avgShoulderZ - avgEarZ (값이 클수록 귀가 어깨보다 카메라 방향으로 앞서 전진함)
    // ------------------------------------------------------------
    const avgEarZ = (leftEar.z + rightEar.z) / 2;
    const avgShoulderZ = (leftShoulder.z + rightShoulder.z) / 2;
    const zDepthOffset = avgShoulderZ - avgEarZ;

    // ------------------------------------------------------------
    // [수학적 알고리즘 4] 거북목 판정 임계치(Threshold) 검사
    // 사용자가 '영점 조절(Calibration)'을 수행했으면 개인 기준치 대비 15% 이상 하강/돌출 시 판정
    // 영점 조절 전이면 인체 통계 기본 임계치(Y: 0.77, Z: 0.17) 적용
    // ------------------------------------------------------------
    let isSlouchingDetect = false;

    if (baselineRef.current) {
      const baseY = baselineRef.current.normalizedEarShoulderY;
      const baseZ = baselineRef.current.zDepthOffset;
      // 기준 대비 Y축 15% 이상 처짐 또는 Z축 전방 돌출 0.08 이상 증가 시 거북목
      const yDrop = (baseY - normalizedEarShoulderY) / baseY;
      const zAdvance = zDepthOffset - baseZ;
      isSlouchingDetect = yDrop > 0.15 || zAdvance > 0.08;
    } else {
      const SLOUCH_Y_THRESHOLD = 0.77;
      const SLOUCH_Z_THRESHOLD = 0.17;
      isSlouchingDetect =
        normalizedEarShoulderY < SLOUCH_Y_THRESHOLD ||
        zDepthOffset > SLOUCH_Z_THRESHOLD;
    }

    setIsSlouching(isSlouchingDetect);

    // 5) 종합 건강 상태 점수 계산 (100점 만점)
    let score = 100;
    
    // 어깨 비대칭 패널티 (편차 0.015 초과 시 급격한 감점)
    const shoulderPenalty = Math.max(0, shoulderBalance - 0.015) * 450;
    score -= shoulderPenalty;

    // 거북목 쏠림에 따른 패널티
    if (baselineRef.current) {
      const baseY = baselineRef.current.normalizedEarShoulderY;
      const yPenalty = Math.max(0, (baseY - normalizedEarShoulderY) / baseY) * 300;
      score -= yPenalty;
    } else {
      const neckYPenalty = Math.max(0, 0.85 - normalizedEarShoulderY) * 350;
      score -= neckYPenalty;
    }

    // Z축 쏠림에 따른 감점 가산
    const neckZPenalty = Math.max(0, zDepthOffset - 0.08) * 200;
    score -= neckZPenalty;

    const postureScore = Math.max(0, Math.min(100, Math.round(score)));

    // 종합 등급 분석
    let status: "perfect" | "warning" | "danger" = "perfect";
    if (isSlouchingDetect || postureScore < 68) {
      status = "danger"; // 거북목으로 판정되었거나 점수가 현저히 낮은 경우
    } else if (postureScore < 83) {
      status = "warning"; // 약한 거북목 전조 증세
    }

    return {
      shoulderBalance,
      neckVerticalDistance,
      normalizedEarShoulderY,
      zDepthOffset,
      postureScore,
      status,
    };
  };

  // ----------------------------------------------------
  // 5. 랜드마크 및 거북목 얼굴 오버레이 필터 실시간 렌더링
  // ----------------------------------------------------
  const drawLandmarksAndFilter = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    landmarks: Landmark[],
    metrics: PostureMetrics
  ) => {
    ctx.clearRect(0, 0, width, height);

    // AI 골격 모니터링 뷰 전용 배경 채우기
    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, width, height);

    // 가이드 격자 그리기
    ctx.strokeStyle = "#162033";
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    const nose = landmarks[0];
    const leftEar = landmarks[7];
    const rightEar = landmarks[8];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];

    const isSlouch = metrics.status === "danger";

    // 1) 기본 골격 뼈대 렌더링 (어깨선)
    if (leftShoulder && rightShoulder) {
      ctx.beginPath();
      ctx.moveTo(leftShoulder.x * width, leftShoulder.y * height);
      ctx.lineTo(rightShoulder.x * width, rightShoulder.y * height);
      ctx.strokeStyle = isSlouch ? "rgba(239, 68, 68, 0.8)" : "rgba(99, 102, 241, 0.8)";
      ctx.lineWidth = 4;
      ctx.stroke();
    }

    // 2) 랜드마크 관절 마커 원형 드로잉
    const keyPoints = [0, 2, 5, 7, 8, 11, 12];
    keyPoints.forEach((idx) => {
      const p = landmarks[idx];
      if (p && (p.visibility ?? 1) > 0.5) {
        ctx.beginPath();
        ctx.arc(p.x * width, p.y * height, 6, 0, 2 * Math.PI);
        if (idx === 11 || idx === 12) {
          ctx.fillStyle = isSlouch ? "#ef4444" : "#3b82f6"; // 어깨 관절
        } else if (idx === 7 || idx === 8) {
          ctx.fillStyle = isSlouch ? "#f97316" : "#22c55e"; // 귀 관절
        } else {
          ctx.fillStyle = "#10b981"; // 얼굴 영역
        }
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });

    // ------------------------------------------------------------
    // [얼굴 마스크 필터 렌더링] 거북목(isSlouching) 상태일 때 작동
    // ------------------------------------------------------------
    if (isSlouch && nose && leftEar && rightEar) {
      // 귀 사이의 거리를 계산해 얼굴 스케일링 인자(머리 너비)로 활용
      const earDistance = Math.sqrt(
        Math.pow(leftEar.x - rightEar.x, 2) +
        Math.pow(leftEar.y - rightEar.y, 2)
      );

      // 필터 이미지 가로 세로 치수 결정 (머리 크기에 딱 맞춰 3.2배 크기로 유연 스케일링)
      const filterWidth = earDistance * width * 3.2;
      const filterHeight = filterWidth; // 정사각형 이미지 상정

      // 코(Nose)를 중앙 기준으로 오프셋 연산하여 필터 위치 좌표 계산
      // 코가 얼굴의 약간 하부에 위치해 있으므로, 필터 Y 좌표를 약간 위로(y 치수의 10%가량) 당겨 정확히 얼굴 전체를 덮도록 유연 조율합니다.
      const filterX = nose.x * width - filterWidth / 2;
      const filterY = nose.y * height - filterHeight * 0.58;

      if (filterImageRef.current && filterImageRef.current.complete) {
        // A) 캐싱된 이미지 리소스(/filter.png)가 존재하고 전송 완료되었을 때 드로잉
        ctx.drawImage(filterImageRef.current, filterX, filterY, filterWidth, filterHeight);
      } else {
        // B) [최고 품질 Fallback] 이미지가 준비 중이거나 존재하지 않을 때, 
        // 캔버스 자체 벡터 그래픽 엔진을 가동해 아주 멋진 공상과학(Sci-Fi) 형태의 '거북목 감지 경보 타겟 홀로그램 링'과 안내 메시지를 정렬해 렌더링합니다!
        
        ctx.save();
        
        // 얼굴 중심 주위에 홀로그램 타겟 링 그리기
        ctx.beginPath();
        ctx.arc(nose.x * width, nose.y * height - filterHeight * 0.08, filterWidth * 0.45, 0, 2 * Math.PI);
        ctx.strokeStyle = "rgba(239, 110, 110, 0.4)";
        ctx.lineWidth = 5;
        ctx.stroke();
        
        // 빨간 경보 점선 외부 링
        ctx.beginPath();
        ctx.arc(nose.x * width, nose.y * height - filterHeight * 0.08, filterWidth * 0.55, 0, 2 * Math.PI);
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.stroke();
        
        // 타겟 십자 정렬선 그리기
        ctx.setLineDash([]);
        ctx.strokeStyle = "rgba(239, 68, 68, 0.6)";
        ctx.lineWidth = 1.5;
        // 가로선
        ctx.beginPath();
        ctx.moveTo(nose.x * width - filterWidth * 0.65, nose.y * height - filterHeight * 0.08);
        ctx.lineTo(nose.x * width + filterWidth * 0.65, nose.y * height - filterHeight * 0.08);
        ctx.stroke();
        // 세로선
        ctx.beginPath();
        ctx.moveTo(nose.x * width, nose.y * height - filterHeight * 0.08 - filterHeight * 0.65);
        ctx.lineTo(nose.x * width, nose.y * height - filterHeight * 0.08 + filterHeight * 0.65);
        ctx.stroke();

        // 텍스트 경고 스캔 배너 오버레이 (얼굴 바로 윗단에 띄우기)
        ctx.fillStyle = "rgba(239, 68, 68, 0.95)";
        const bannerW = 200;
        const bannerH = 34;
        const bannerX = nose.x * width - bannerW / 2;
        const bannerY = nose.y * height - filterHeight * 0.72;
        
        ctx.beginPath();
        ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 8);
        ctx.fill();

        ctx.font = "bold 12px monospace";
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("⚠️ DETECT SLOUCHING! ⚠️", nose.x * width, bannerY + bannerH / 2);

        // 하단 복귀 권장 안내선
        ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
        ctx.font = "bold 11px sans-serif";
        ctx.fillText("어깨를 펴고 머리를 뒤로 미세요!", nose.x * width, bannerY + bannerH + 15);

        ctx.restore();
      }
    }
  };

  // ----------------------------------------------------
  // 6. 웹캠 장치 활성화 (카메라 온)
  // 스냅샷 주기적 타이머 Ref
  const snapshotTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ----------------------------------------------------
  // 6. 스냅샷 수동 / 자동 캡처
  // ----------------------------------------------------
  const captureSnapshot = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;

    try {
      const snapCanvas = document.createElement("canvas");
      snapCanvas.width = 320;
      snapCanvas.height = 180;
      const ctx = snapCanvas.getContext("2d");
      if (!ctx) return null;

      // 비디오 프레임 그리기
      ctx.drawImage(video, 0, 0, snapCanvas.width, snapCanvas.height);

      // 오버레이 캔버스도 존재하면 합성
      if (canvasRef.current && canvasRef.current.width > 0) {
        ctx.drawImage(canvasRef.current, 0, 0, snapCanvas.width, snapCanvas.height);
      }

      const dataUrl = snapCanvas.toDataURL("image/jpeg", 0.7);
      setSnapshotUrl(dataUrl);
      return dataUrl;
    } catch (e) {
      console.warn("스냅샷 캡처 중 오류:", e);
      return null;
    }
  }, []);

  // ----------------------------------------------------
  // 7. 웹캠 장치 활성화 (카메라 온)
  // ----------------------------------------------------
  const startDetection = async () => {
    if (isDetecting) return;
    setError(null);

    try {
      const landmarker = await initPoseLandmarker();

      let stream: MediaStream;
      try {
        // 장치 목록을 조회하여 노트북 내장 웹캠(LG HD Webcam 등)을 최우선 탐색
        let targetDeviceId: string | undefined = undefined;
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter((d) => d.kind === "videoinput");
          
          // 1순위: 'LG HD Webcam' 또는 'Integrated', '내장', 'Webcam'이 포함된 노트북 자체 카메라
          const builtInCam = videoDevices.find((d) => 
            /lg hd webcam|integrated|internal|내장/i.test(d.label)
          ) || videoDevices.find((d) => 
            !/phone|crossdevice|droidcam|iriun|virtual/i.test(d.label)
          );

          if (builtInCam && builtInCam.deviceId) {
            targetDeviceId = builtInCam.deviceId;
          }
        } catch (enumErr) {
          console.warn("카메라 장치 목록 조회 생략:", enumErr);
        }

        const videoConstraints: MediaTrackConstraints = targetDeviceId
          ? {
              deviceId: { exact: targetDeviceId },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }
          : {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: "user",
            };

        stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false,
        });
      } catch (mediaErr: any) {
        console.warn("특정 웹캠 고정 요청 실패, 기본 웹캠 설정으로 시도합니다:", mediaErr);
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
        setIsDetecting(true);
        startDetectionLoop(landmarker);

        // 최초 1.5초 후 1회 스냅샷 캡처 및 이후 10초 주기로 갱신
        if (snapshotTimerRef.current) clearInterval(snapshotTimerRef.current);
        const initialSnapTimeout = setTimeout(() => {
          captureSnapshot();
          snapshotTimerRef.current = setInterval(captureSnapshot, 10000);
        }, 1500);

        // 클린업에 등록하기 위한 임시 저장
        (stream as any)._initialSnapTimeout = initialSnapTimeout;
      }
    } catch (err: any) {
      console.error("웹캠 모니터링 시동 오류:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setError("카메라 권한 획득에 실패했습니다. 브라우저 주소창 왼쪽 자물쇠 아이콘에서 카메라 권한을 허용해 주세요.");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setError("연결된 웹캠을 찾을 수 없습니다. 노트북 내장 카메라 또는 외장 웹캠 연결을 확인해 주세요.");
      } else {
        setError(err.message || "카메라 및 AI 자세 분석 모듈 시동에 실패했습니다.");
      }
      setIsDetecting(false);
    }
  };

  // ----------------------------------------------------
  // 8. 웹캠 장치 비활성화 및 리소스 클린업 (카메라 오프)
  // ----------------------------------------------------
  const stopDetection = useCallback(() => {
    if (snapshotTimerRef.current) {
      clearInterval(snapshotTimerRef.current);
      snapshotTimerRef.current = null;
    }

    if (streamRef.current) {
      const initialTimeout = (streamRef.current as any)._initialSnapTimeout;
      if (initialTimeout) clearTimeout(initialTimeout);

      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }

    setIsDetecting(false);
    setLandmarks(null);
    setMetrics(null);
    setIsSlouching(false);
    setSnapshotUrl(null);
  }, []);

  const toggleDetection = () => {
    if (isDetecting) {
      stopDetection();
    } else {
      startDetection();
    }
  };

  // ----------------------------------------------------
  // 9. 언마운트 시 GC(가비지컬렉터) 작동 보조 메모리 해제
  // ----------------------------------------------------
  useEffect(() => {
    return () => {
      stopDetection();
      if (poseLandmarkerRef.current) {
        try {
          poseLandmarkerRef.current.close();
        } catch (e) {
          console.error("MediaPipe 모델 소멸 실패:", e);
        }
        poseLandmarkerRef.current = null;
      }
    };
  }, [stopDetection]);

  return {
    videoRef,
    canvasRef,
    landmarks,
    metrics,
    isModelLoading,
    isDetecting,
    isSlouching,
    isCalibrated,
    snapshotUrl,
    error,
    startDetection,
    stopDetection,
    toggleDetection,
    calibrate,
    captureSnapshot,
  };
}
