# 📋 8주차 프로젝트 패키징 및 개발 보고서

- **교과목 / 프로젝트**: 프로젝트 패키징 (졸업작품)
- **과제명**: 목지키미 (웹 기반 온디바이스 AI 자세 모니터링 & 소셜 뽀모도로 스터디룸)
- **팀명**: 힘들조
- **작성자 / 담당 역할**: 컴퓨터소프트웨어과 김재호 (Team Lead / Full-Stack & Database)
- **작업 일시**: 2026년 10월 20일 (8주차)

---

## 1. 8주차 목표 및 진행 배경

- **7주차 회의록(`(26.10.13).hwp`) 수립 목표**:
  - ✅ **자세 붕괴 시 생성된 캡처 이미지를 스터디룸 프로필로 실시간 전송/업데이트 (완료)**: 로컬에서만 생성되던 거북목 경고 스냅샷을 Firestore `rooms/{roomId}/members/{uid}`에 실시간 동기화하여 스터디원 전체에게 박제 프로필 이미지 공유
  - ✅ **누적 데이터 Recharts 통계 차트 시각화 (완료)**: 7일간의 일별 자세 점수 추이 및 집중 시간, 거북목 방지 횟수를 한눈에 파악할 수 있는 대시보드 모달 구현
  - ✅ **로컬호스트(localhost:3001) 환경 연결 및 실시간 동작 검증 (완료)**: Next.js Turbopack dev server 기동 및 0-error 컴파일 달성

---

## 2. 세부 구현 내용

### (1) 자세 붕괴(거북목) 시 자동 Canvas 박제 캡처 및 Firestore 실시간 동기화
- **위치**: `hooks/usePostureDetection.ts`, `lib/room.ts`, `app/room/[roomId]/page.tsx`
- **핵심 로직**:
  - `usePostureDetection` 내 랜드마크 분석 루프에서 `status === 'danger'` (또는 `warning`) 감지 시 4초 쿨다운을 거쳐 합성 Canvas 스냅샷 자동 생성 (`captureSnapshot()`).
  - 생성된 JPEG 스냅샷 DataURL을 `StudyRoomPage`의 `syncPostureAndSnapshot`을 통해 Firestore의 `members/{uid}` 문서에 `posture` 상태와 함께 동시 기록.
  - 방 내 모든 참가자의 실시간 리스너를 통해 `toParticipant`에서 `snapshotUrl`을 자동 수신하여 `ParticipantCard.tsx`의 스터디원 카드에 박제 이미지가 즉각 반영되도록 파이프라인 완성.

### (2) Recharts 기반 누적 자세 & 집중 통계 대시보드 모달 (`components/PostureStatsModal.tsx`)
- **위치**: `components/PostureStatsModal.tsx`, `lib/statsService.ts`
- **핵심 기능**:
  - **4대 KPI 요약 카드**: 주간 평균 자세 점수(등급 A+~C), 총 집중 시간, 거북목 교정 방지 횟수, 연속 실천 스트릭.
  - **탭 1 (📈 일별 자세 점수 추이)**: Recharts `AreaChart`를 사용하여 주간 자세 점수의 부드러운 그라디언트 곡선 및 일별 상세 툴팁 렌더링.
  - **탭 2 (⏱️ 집중 시간 & 경고 빈도)**: Recharts `BarChart` 복합 축을 통해 날짜별 집중 시간(분)과 거북목 위험 경고 횟수를 한눈에 비교 분석.
  - **AI 코칭 진단 리포트**: 주간 데이터를 종합 분석하여 맞춤형 자세 교정 가이드 및 20-20-20 스트레칭 권장 문구 동적 제공.
  - **클라이언트 마운트 가드**: SSR 하이드레이션 오류 없이 매끄럽게 렌더링되도록 방어 로직 적용.

### (3) 전역 헤더 및 스터디룸 연동 (`components/Header.tsx`, `app/room/[roomId]/page.tsx`)
- 메인 헤더 및 스터디룸 메타 바에 `[📊 내 자세 통계]` 버튼을 배치하여 언제든 원클릭으로 주간 리포트 모달을 열람할 수 있도록 UI 배치.
- 팀원 연동 데모 (`[👥 팀원 연동 데모]`) 상태와 완벽히 호환되도록 구성.

---

## 3. 검증 및 테스트 결과

1. **TypeScript 정적 타입 검사**:
   - `npx tsc --noEmit`: **0 error (에러 없이 통과)**
2. **Next.js 16.3.5 Turbopack 빌드 & 구동**:
   - 로컬 개발 서버 `http://localhost:3001` 정상 기동 (`HTTP 200 OK`)
   - 메인 랜딩(`/`) 및 스터디룸(`/room/[roomId]`) 하이드레이션 에러 없이 400ms 이내 초고속 컴파일 확인
3. **스냅샷 & 통계 차트 실시간 렌더링**:
   - 거북목 감지 시 캡처 스냅샷 자동 생성 및 프로필 카드 반영 확인
   - Recharts 주간 점수/시간 그래프 정상 표시 확인

---

## 4. 8주차 완료 요약

| 구분 | 주요 개발 항목 | 담당 | 상태 |
| :---: | :--- | :---: | :---: |
| **Backend & Sync** | Firestore `Member` 모델 `snapshotUrl` 필드 추가 및 실시간 동기화 | 김재호 | ✅ 완료 |
| **AI Vision** | 거북목 자세 무너짐 감지 시 쿨다운 기반 자동 Canvas 캡처 트리거 | 김재호 / 안정민 | ✅ 완료 |
| **Frontend & Viz** | Recharts 누적 자세 점수 & 집중 시간 통계 대시보드 (`PostureStatsModal`) | 김재호 / 박진규 | ✅ 완료 |
| **Localhost** | Next.js 로컬 개발 서버 기동 및 브라우저 연동 검증 | 김재호 | ✅ 완료 |
