import type { PostureStatus } from '@/lib/room'
import { Avatar, type AvatarKind } from './Avatar'
import { Icon } from './Icon'

export type ParticipantStatus = 'focus' | 'break' | 'away' | 'ready'

export interface ParticipantView {
  id: string
  nickname: string
  status: ParticipantStatus
  posture: PostureStatus | null // null = 카메라 꺼짐
  snapshotUrl?: string
}

const statusLabels: Record<ParticipantStatus, string> = { focus: '집중 중', break: '휴식 중', away: '자리 비움', ready: '준비 중' }
const postureLabels: Record<PostureStatus | 'off', { text: string; className: string }> = {
  perfect: { text: '바른 자세', className: 'posture-good' },
  warning: { text: '자세 주의', className: 'posture-warning' },
  danger: { text: '자세를 확인해 주세요', className: 'posture-poor' },
  off: { text: '카메라 꺼짐', className: '' },
}

const AVATARS: AvatarKind[] = ['sprout', 'bear', 'cat', 'bunny']

// uid 로 아바타를 고정 배정해 모든 참가자 화면에서 같은 캐릭터로 보이게 합니다.
export function avatarFor(id: string): AvatarKind {
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return AVATARS[Math.abs(hash) % AVATARS.length]
}

export function ParticipantCard({ participant, isMe = false }: { participant: ParticipantView; isMe?: boolean }) {
  const posture = postureLabels[participant.posture ?? 'off']
  const avatar = avatarFor(participant.id)
  return <article className={`participant-card ${isMe ? 'my-card' : ''} ${participant.status === 'away' ? 'is-away' : ''}`}>
    <div className="participant-top"><span className={`person-badge ${isMe ? 'me-badge' : ''}`}>{isMe ? '나' : '참여자'}</span><span className={`status status-${participant.status}`}><span />{statusLabels[participant.status]}</span></div>
    {isMe ? <div className="snapshot-area">
      {participant.snapshotUrl ? <img src={participant.snapshotUrl} alt={`${participant.nickname}님의 자세 스냅샷`} className="snapshot-image" /> : <><Avatar kind={avatar} /><span className="snapshot-caption"><Icon name="camera" size={13} />스냅샷 연결 예정</span></>}
    </div> : <div className="sample-avatar">{participant.snapshotUrl ? <img src={participant.snapshotUrl} alt={`${participant.nickname}님의 자세 스냅샷`} className="snapshot-image" /> : <Avatar kind={avatar} />}</div>}
    <h3 className="participant-name">{participant.nickname}</h3>
    <div className="posture-line"><span><Icon name="leaf" size={15} />자세 상태</span><span className={posture.className}>{posture.text}</span></div>
  </article>
}
