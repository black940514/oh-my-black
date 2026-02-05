# 🇰🇷 Oh-My-Black 한국어 사용자 가이드

> **다중 에이전트 자동화 시스템으로 10배 빠르게 일하기**

[![npm version](https://img.shields.io/npm/v/oh-my-black?color=cb3837)](https://www.npmjs.com/package/oh-my-black)

---

## 목차

1. [설치하기](#설치하기)
2. [빠른 시작](#빠른-시작)
3. [핵심 모드](#핵심-모드)
4. [자주 쓰는 명령어](#자주-쓰는-명령어)
5. [에이전트 활용](#에이전트-활용)
6. [실전 시나리오](#실전-시나리오)
7. [팁과 트릭](#팁과-트릭)
8. [고급 기능](#고급-기능)
9. [문제 해결](#문제-해결)

---

## 설치하기

### 사전 요구사항

- [Claude Code](https://docs.anthropic.com/claude-code) CLI 설치
- Claude Max/Pro 구독 또는 Anthropic API 키
- Node.js 18+

### 방법 1: Claude Code 플러그인 (권장) ⭐

터미널에서 세 줄만 실행하면 됩니다:

```bash
# 1. 마켓플레이스 추가
claude plugin marketplace add github:black940514/oh-my-black

# 2. 플러그인 설치
claude plugin install oh-my-black@oh-my-black

# 3. Claude Code 재시작 후, Claude Code 안에서:
/oh-my-black:omb-setup
```

**끝!** 이게 전부입니다.

### 방법 2: npm 글로벌 설치

```bash
npm install -g oh-my-black
```

### 설치 확인

Claude Code 안에서 실행:

```
/oh-my-black:doctor
```

이 명령어가 작동하면 설치 완료입니다. 문제가 있으면 자동으로 수정해줍니다.

---

## 빠른 시작

### 핵심 철학: "그냥 원하는 거 말해주면 돼"

Oh-My-Black은 **복잡한 명령어 없이 자연스럽게 말하면** 됩니다.

#### 예시: 바로 시작하기

```
"REST API 만들어줘. 사용자 관리하는 거."
```

→ Oh-My-Black이 자동으로 **autopilot 모드**를 활성화하고:
- 요구사항 정리
- 기술 스택 선택
- 코드 생성
- 테스트 작성
- 검증까지 모두 처리

**복잡한 명령어를 외울 필요 없습니다. 자연스럽게 말하면 자동으로 작동합니다.**

### Autopilot 기본 사용법

Autopilot은 핵심 기능입니다. 처음부터 끝까지 완전 자동화됩니다.

**자동으로 시작되는 경우:**

| 말하면... | 자동으로... |
|-----------|-------------|
| "만들어줘", "Build me" | Autopilot 활성화 |
| "구현해줘", "Create" | Autopilot 활성화 |
| "빌드해줘", "I want a" | Autopilot 활성화 |

**Autopilot 안에서 일어나는 일:**

1. **자동 계획**: 요구사항 정리, 아키텍처 설계
2. **병렬 실행**: 여러 에이전트가 동시에 작업
3. **자동 테스트**: 만들어진 코드 자동 테스트
4. **자동 검증**: 문제 있으면 자동 수정
5. **자동 완료**: 모든 게 완료될 때까지 계속 실행

**당신은 중간에 아무것도 할 필요 없습니다.**

---

## 핵심 모드

### 1. Autopilot - 완전 자동화 (기본값)

**언제?** 처음부터 끝까지 완전히 자동으로 처리하고 싶을 때

```
"autopilot: React 대시보드 만들어줄래? 판매량 차트 포함으로"
```

또는 그냥:

```
"React 대시보드 만들어줄래?"
```

→ 자동으로 autopilot 시작

### 2. Ralph - 끝까지 해주는 모드

**언제?** "절대 중간에 멈추지 마"할 때

```
"ralph: 이 버그 찾아서 고쳐줄래? 몇 시간 걸려도 괜찮아"
```

**특징:** 에러가 나도 계속 시도. 포기하지 않음.

### 3. Ultrawork (ulw) - 병렬 고속 실행

**언제?** 빠른 속도가 중요할 때

```
"ulw: 이 5개 파일에 에러 핸들링 추가해줘"
```

**특징:** 3-5배 더 빠름. 독립적인 작업 동시 처리.

### 4. Ecomode (eco) - 토큰 절약 모드

**언제?** 비용을 아껴야 할 때

```
"eco: 이 코드에 주석 추가해줄래?"
```

**특징:** 70% 비용 절감. 복잡하면 자동 업그레이드.

### 5. Plan - 계획 수립 모드

**언제?** 어떻게 할지 모를 때

```
"plan: 이 프로젝트 어떻게 구조화할지 봐줄래?"
```

**특징:** 인터랙티브 인터뷰. 여러 옵션 제시.

---

## 자주 쓰는 명령어

### Magic Keywords (마법의 키워드들)

| 키워드 | 효과 | 예시 |
|-------|------|------|
| `autopilot` | 완전 자동화 | "autopilot: REST API 만들어줄래?" |
| `ralph` | 끝까지 완료 | "ralph: 이 버그 고쳐줄래?" |
| `ulw` | 병렬 고속 | "ulw: 5개 파일 수정" |
| `eco` | 토큰 절약 | "eco: 코드 포매팅" |
| `plan` | 계획 수립 | "plan: 어떻게 할까?" |

**팁:** 키워드를 문장 어디에나 붙이면 됩니다.

### 슬래시 명령어

| 명령어 | 용도 |
|--------|------|
| `/oh-my-black:omb-setup` | 초기 설정 |
| `/oh-my-black:doctor` | 문제 진단 및 자동 수정 |
| `/oh-my-black:help` | 전체 명령어 목록 |
| `/oh-my-black:note` | 메모 추가 |
| `/oh-my-black:hud` | 상태바 설정 |

### 작업 취소

```
cancelomc
```
또는
```
stopomc
```

→ 현재 실행 중인 모든 작업이 안전하게 중단됩니다.

---

## 에이전트 활용

Oh-My-Black 뒤에는 **39개의 전문 에이전트**가 있습니다.

### 주요 에이전트

| 에이전트 | 역할 | 자동 활성화 |
|----------|------|-------------|
| **Executor** | 코드 작성 | 모든 코딩 요청 |
| **Architect** | 설계, 검증 | 작업 완료 후 자동 |
| **Designer** | UI/UX | "버튼 예쁘게", "UI 개선" |
| **Researcher** | 문서 찾기 | "어떻게 하지?", "라이브러리?" |
| **Analyst** | 문제 분석 | "왜 느린 거야?", "병목이 뭐지?" |

### 자동 선택 예시

| 요청 | 자동 선택 |
|------|-----------|
| "함수 작성해줄래?" | executor + architect |
| "UI 개선해줄래?" | designer + executor |
| "성능 문제 고쳐줄래?" | analyst + executor-high |

**당신이 해야 할 일:** 그냥 원하는 걸 말하세요. 나머지는 자동입니다.

---

## 실전 시나리오

### 시나리오 1: REST API 만들기

```
"Node.js로 사용자 관리 REST API 만들어줄래? 인증도 포함으로"
```

→ Autopilot이 자동으로: 요구사항 결정 → 코드 작성 → 테스트 → 검증 → 완료

### 시나리오 2: 빠른 다중 파일 수정

```
"ulw: 5개 API 핸들러에 에러 핸들링 추가해줄래?"
```

→ 5개 파일 동시 처리. 순차보다 80% 시간 절약.

### 시나리오 3: 복잡한 버그 수정

```
"ralph: 이 결제 시스템 버그 찾아서 고쳐줄래? 몇 시간 걸려도 괜찮아"
```

→ Ralph가 포기하지 않고 끝까지 해결.

### 시나리오 4: 비용 절약 모드

```
"eco: 10개 파일에 주석 달고 타입 추가해줄래?"
```

→ 70% 비용 절감하면서 완료.

---

## 팁과 트릭

### 팁 1: 모드 조합하기

```
1단계: "plan: 어떻게 할까?"        → 계획 수립
2단계: "eco: 기본 구조 만들어줄래?"  → 저비용으로 뼈대
3단계: "ulw: 5개 모듈 구현해줄래?"  → 병렬로 빠르게
4단계: "ralph: 모든 버그 고쳐줄래?" → 끝까지 검증
```

### 팁 2: 토큰 절약하기

- **Ecomode 활용**: 간단한 작업은 `eco` 사용 (70% 절약)
- **명확하게 요청**: "이거 봐줄래?" ❌ → "이 함수에서 null 체크 추가" ✅
- **한 번에 많이**: 여러 작은 요청 ❌ → 한 번의 큰 요청 ✅

### 팁 3: 메모 시스템 활용

```
/oh-my-black:note --priority "API 키는 .env에 있음"
→ 다음 세션에도 자동으로 로드됨
```

---

## 고급 기능

### ohmyblack 시스템 (Builder-Validator 사이클)

코드 작성 후 자동 검증:

```
autopilot --ohmyblack "REST API 만들어줄래?"
```

또는 글로벌 활성화:

```bash
export OMB_OHMYBLACK_DEFAULT=true
```

### 검증 레벨

| 레벨 | 용도 | 오버헤드 |
|------|------|---------|
| `self-only` | 빠른 단순 작업 | +5% |
| `validator` | 일반 작업 (기본값) | +15% |
| `architect` | 중요한 변경 | +30% |

```bash
autopilot --ohmyblack --validation=architect "결제 시스템"
```

### 팀 자동 구성

```bash
ultrawork --auto-team "새로운 기능"
```

→ 작업 복잡도에 따라 최적 팀 자동 구성

### 설정 파일 (`.omb-config.json`)

```json
{
  "defaultExecutionMode": "ultrawork",
  "ohmyblack": {
    "enabled": true,
    "defaultValidationLevel": "validator",
    "autoTeamComposition": true
  }
}
```

---

## 문제 해결

### "설치가 안 됐어요"

```
/oh-my-black:doctor
```

→ 자동 진단 및 수정

### "작업이 중간에 멈췄어요"

```
1. cancelomc           → 먼저 취소
2. "ralph: 마저 해줄래?" → Ralph로 재시도
```

### "너무 비싸요"

```
"eco: 이 작업 해줄래?"
→ 70% 토큰 절약
```

### "HUD가 안 보여요"

```
/oh-my-black:hud setup
```

---

## 요약: Oh-My-Black의 진짜 강점

**"그냥 자연스럽게 말하면 된다"**

- 복잡한 명령어 외울 필요 없음
- 에러 나도 자동으로 다시 시도
- "이게 가능할까?" → 대부분 가능

**철학:** 당신은 아이디어를 말하고, Oh-My-Black은 실행한다.

---

## 다음 단계

1. **지금 바로 시작:**
   ```
   "autopilot: 간단한 Todo 앱 만들어줄래?"
   ```

2. **문제 있으면:**
   ```
   /oh-my-black:doctor
   ```

3. **더 알고 싶으면:**
   ```
   /oh-my-black:help
   ```

---

<div align="center">

**Zero learning curve. Maximum power.**

[← 메인 README로 돌아가기](../README.md)

</div>
