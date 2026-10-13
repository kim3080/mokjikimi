import { Icon } from './Icon'

export function FirebaseSetupNotice() {
  return <div className="setup-banner" role="alert"><Icon name="info" size={17} /><p><strong>Firebase 설정이 필요해요.</strong> 프로젝트 루트의 <code>.env.example</code>을 복사해 <code>.env.local</code>을 만들고 Firebase 웹 앱 설정값을 채운 뒤, 개발 서버를 다시 시작해 주세요.</p></div>
}
