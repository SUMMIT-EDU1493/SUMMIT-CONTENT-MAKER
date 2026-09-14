# SUMMIT CONTENT MAKER — PROJECT STATUS

마지막 정리: 2026-09-14

이 파일은 새 ChatGPT 대화로 넘어갔을 때 프로젝트 상태를 빠르게 복구하기 위한 인수인계 문서다.

---

## 1. 프로젝트 기본 정보

- GitHub: SUMMIT-EDU1493/SUMMIT-CONTENT-MAKER
- 로컬 경로: C:\Users\Hee\SUMMIT-CONTENT-MAKER
- 배포: Vercel
- 주소: https://summit-content-maker.vercel.app
- Framework: Next.js 16.3.4 / App Router / TypeScript / Tailwind
- 개발환경: Windows PowerShell + VS Code
- Node: v24.x
- npm은 PowerShell 정책 문제 때문에 `npm.cmd`, `npx.cmd` 사용
- OpenAI 환경변수는 Vercel에 설정되어 있음
- API KEY를 채팅이나 코드에 직접 넣지 말 것

---

## 2. 사용자 작업 방식 — 매우 중요

### 코드 제공 규칙

- 일부 코드 조각보다 영향받는 파일의 전체 코드 또는 정확한 PowerShell 패치를 선호
- 사용자가 복붙해야 하는 코드 외에는 불필요한 코드를 보여주지 말 것
- 코드 수정 전 실제 현재 파일 구조와 함수명을 먼저 확인할 것
- 추측으로 함수명/위치를 잡지 말 것
- 한두 번 패치가 꼬이면 복잡하게 밀어붙이지 말고 더 단순한 방법으로 전환
- 가능하면 한 번에 관련 항목 전체를 검사하여 수정
- 반복적으로 사용자가 오류를 발견하게 만들지 말 것

### 터미널 규칙

터미널 명령을 줄 때 항상 첫 줄:

cd $HOME\SUMMIT-CONTENT-MAKER

- Windows PowerShell 전용 명령 사용
- bash 명령 사용 금지
- npm 대신 npm.cmd
- npx 대신 npx.cmd

### 기본 작업 순서

수정
→ git status 확인
→ npx.cmd tsc --noEmit
→ npm.cmd run build
→ 실제 테스트
→ git add / commit / push
→ Vercel 반영 확인

---

## 3. 현재 브랜드

- SUMMIT VISUAL LAB
- 한글 별칭: 써밋 비주얼랩 / 써비랩
- 사용자-facing 표기: "컨텐츠"
- 로고 파일:
  - public/summit-logo.png
  - public/summit-logo-trimmed.png
  - public/summit-edu.png
  - public/summit-bulb.png

폰트:
- public/fonts/NotoSansKR-Bold.ttf
- public/fonts/NanumGothic-Regular.ttf
- public/fonts/Gaegu-Bold.ttf

---

## 4. 주요 페이지

### 중등

- /
  - 중등 대화문 써밋네컷
- /middle-passage

### 고등 영어

- /high-test
  - 고등 써밋네컷
- /high-summary-test
  - 고등 요약.ZIP
- /english-test-maker

### 고등 국어

- /korean-summary
- /korean-test-maker
- /korean-twin-questions

---

## 5. 고등 써밋네컷 — 안정화 완료 영역

고등 써밋네컷은 전반적으로 퀄리티가 안정된 상태.

### 지문 인식

실제 11페이지 PDF에서 독립 지문 10개를 정확히 추출하도록 수정 완료.

기존 3~6개 제한 제거.

### 이미지 생성 속도

전체 이미지 생성:
- worker pool
- 동시 3개 생성

이 구조는 안정적이므로 함부로 바꾸지 말 것.

### 화풍 다양화

고등 써밋네컷 visualStyle:

1. graphic novel
2. editorial illustration
3. cinematic storyboard
4. modern webtoon
5. ink drawing comic
6. painterly illustration
7. collage magazine comic
8. retro comic book
9. minimal conceptual illustration
10. infographic comic

이미지 프롬프트에:

ILLUSTRATION ONLY — NO PHOTOREALISM

규칙 적용 완료.

사용자 테스트 결과:
- 화풍 다양함
- 실사 없음
- 품질 만족

### 대사 수정

고등 써밋네컷 대사 수정은 팝업/modal 방식.
사용자 만족도가 높으므로 구조 유지.

---

## 6. 고등 요약.ZIP — 안정화 완료 영역

사용자가 현재 퀄리티에 매우 만족.

### 지문 추출

독립 지문 개수 제한 제거.

### 이미지

이미지 품질 안정.

### 인쇄 레이아웃

2026-09-11 수정 완료.

문제:
- 상단 여백 너무 큼
- 하단 일부 잘림

수정:
- 상단 여백 축소
- 본문 위로 이동
- 하단 인쇄 안전영역 확보

사용자 실제 출력 결과:
"여백조절은 아주 완벽"

이 프롬프트/여백 설정은 함부로 다시 바꾸지 말 것.

---

## 7. PDF 저장 방식 — 중요

2026-09-11 아래 3곳 모두 PDF 저장 방식을 통일함.

1. 중등 써밋네컷
2. 고등 써밋네컷
3. 고등 요약.ZIP

각 화면에 두 가지 저장 방식 제공:

### 일반 PDF 저장

순서:
앞표지
→ 본문 1
→ 본문 2
→ ...
→ 뒷표지

화면 보기 / GoodNotes / 일반 저장용.

### 소책자 인쇄용 PDF 저장

PDF 자체에서 소책자 순서로 재배열.

예: 8페이지

8, 1
2, 7
6, 3
4, 5

부족한 페이지는 뒷표지 앞에 빈 페이지 삽입.

앞표지와 뒷표지가 실제 접었을 때 외부 표지가 되도록 구성.

### 성공한 실제 인쇄 설정

- A4
- 가로
- 한 면에 2페이지
- 양면인쇄
- 짧은 쪽 넘김
- 프린터 자체 "소책자" 기능은 끔

사용자가 실제 출력 테스트 후 성공 확인.

### A4 이미지 크기

중등 써밋네컷에 있던 10mm PDF margin 제거 완료.

현재:
중등 써밋네컷
고등 써밋네컷
고등 요약집

모두 A4 landscape 전체 페이지 배치 방식으로 통일.

---

## 8. 중등 대화문 써밋네컷 — 현재 작업 중

app/page.tsx

### 1차 UI 수정 적용 완료

- lessonName 기본값 "Lesson "
- 메인 SUMMIT VISUAL LAB 정리
- 부교재 화살표 색상 조정
- 고등영어 카드 설명:
  "교과서 · 모의고사 · 외부지문"
- 컨텐츠 선택 화면 상단:
  SUMMIT VISUAL LAB
- 중등 대화문 상단:
  SUMMIT VISUAL LAB
- 설명:
  "영어교과서의 대화문을 찾아 써밋네컷으로 제작합니다."
- "대화문 LIST"
- 삭제 버튼:
  "이 대화문 삭제"
- 설계안 관련 문구 formal tone으로 수정
- 뒷표지 안내 문구 formal tone으로 수정
- 여러 alert/error 문구 formal tone으로 수정
- "내용 구분" UI 제거 시도/적용
- 버튼 cursor 일부 정리

타입검사 및 production build 성공.

### 아직 완료되지 않은 중등 2차 작업

중요:
아래 작업은 아직 완료된 것으로 가정하지 말 것.

1. 중등 대사 수정 UI를 고등처럼 modal 방식으로 변경

2. 전체 설계안 생성 속도 개선
현재 과거 코드 기준 순차 처리였음:

for (...) {
  await requestComicPlan(...)
}

목표:
worker pool 동시 3개

3. 전체 이미지 생성 속도 개선
현재 과거 코드 기준 순차 처리였음:

for (...) {
  await requestComicImage(...)
}

목표:
worker pool 동시 3개

4. 이미지 생성 진행상황 표시
예:
현재 3/7 이미지 생성 중

5. 중등 화풍 다양화
고등의 visualStyle 시스템을 중등에도 적용

6. 실사 방지
중등 이미지 프롬프트에도:

ILLUSTRATION ONLY — NO PHOTOREALISM

강한 규칙 추가

7. 관계에 맞는 말투

예:
- 학생 → 부모: 자연스러운 가족 존댓말
- 학생 → 교사/성인: 존댓말
- 학생 ↔ 친구: 자연스러운 반말
- 부모 → 자녀: 자연스러운 가족 말투
- 교사 → 학생: 교사 말투

학생이 부모/교사에게 친구처럼 말하지 않도록 프롬프트 보강 필요.

8. 동적 버튼 문구

기존 형태가 남아 있을 가능성:
"남은 7개 전체 설계안 만들기"

목표:
"7개 대화문 설계안 만들기"

9. 중등 UI 전체에서 남아 있는 반말/비격식 문구 한 번에 점검

10. 버튼 cursor-pointer 전체 점검

### 중등 이미지 API

app/api/generate-comic/route.ts

현재 기본 스타일 문구는 과거 확인 기준:

"modern Korean educational webtoon"

으로 사실상 화풍이 고정되어 있음.

고등 스타일 다양화 구조를 참고하되
중학생에게 지나치게 성인 느낌/실사 느낌이 나지 않도록 조정 필요.

---

## 9. 중등 속도 병목 — 이미 확인된 사실

과거 실제 코드 확인 결과:

### 설계안

makeAllComicPlans

각 대화문을 for loop 안에서 await 해서 순차 생성.

### 이미지

generateAllComicImages

각 이미지를 for loop 안에서 await 해서 순차 생성.

사용자 경험상 전체 생성이 약 10분까지 걸릴 수 있어
상용 서비스 관점에서 너무 느리다고 판단.

고등에서 이미 안정적으로 쓰는 concurrency 3 패턴을
중등에도 적용하는 것이 1순위.

---

## 10. /api/analyze

중등 대화문 추출 속도도 느리다는 사용자 의견 있음.

단,
설계안/이미지처럼 병목 원인이 아직 정확히 확인된 상태는 아님.

다음 수정 전:
app/api/analyze/route.ts
실제 현재 코드 확인 후 결정.

추측으로 모델/로직 변경하지 말 것.

---

## 11. 고등 국어 — 다음 단계에서 주의

사용자가 "고등국어 하자"라고 하면 먼저 확인할 것:

현재 한국어 PDF 텍스트 추출에서
.join(" ")
방식이 원문 문단 경계를 무너뜨릴 가능성이 있음.

첫 작업:
원본 PDF의 문단 구분
→ 추출
→ 결과 PDF
까지 유지하도록 개선.

현재 안정적인 페이지:
- /korean-summary
- /korean-test-maker
- /korean-twin-questions
- /api/korean-question-pdf

예전에 사용했던 crop/image 방식은 되살리지 말 것.

---

## 12. 관리자 비용 추적 — 보류 중

추후 만들 예정.

목표:
- 어떤 API route가 호출됐는지
- 모델
- text/image
- 성공/실패
- usage
- 예상 비용 USD/KRW
- 날짜별 / 기능별 사용량
- /admin 화면

주의:
기존 과거 사용량은 자체 DB가 없었으므로 정확히 복원 불가.

새 추적 시스템 설치 이후부터 기록.

DB를 새로 정하기 전에 프로젝트 내부에 기존 DB가 있는지 먼저 검사.

---

## 13. 로컬 개발 환경 주의

과거 GitHub Codespaces 무료 사용량 초과로
Windows 로컬 개발환경으로 이전.

설치 완료:
- VS Code
- Git for Windows
- Node
- npm install

초기 로컬 build 성공.

PC RAM:
약 8GB

한때 available RAM이 0.5GB까지 떨어져
Next build / TypeScript가 메모리 부족으로 실패함.

재부팅 후 2.2GB 확보하자
TypeScript와 Next build 정상 성공.

빌드가 이상하게 죽으면
코드 오류부터 단정하지 말고
먼저 시스템 RAM 확인.

---

## 14. 검증 명령

타입 검사:

npx.cmd tsc --noEmit

프로덕션 빌드:

npm.cmd run build

Git 상태:

git status --short

---

## 15. 이미지 비용 절약 원칙

이미지 프롬프트나 API를 수정했을 때:

전체 10장 생성부터 하지 말 것.

먼저:
1장 또는 2장만 테스트
→ 품질 확인
→ 전체 생성

사용자가 이미지 API 비용 낭비를 매우 싫어함.

---

## 16. 현재 다음 작업 우선순위

다음 개발 재개 시:

1순위:
중등 대화문 써밋네컷 2차 개선

- 대사 수정 modal
- 설계안 concurrency 3
- 이미지 concurrency 3
- 진행상황 표시
- 중등 visualStyle 다양화
- NO PHOTOREALISM
- 관계별 말투
- 남아 있는 비격식 UI 문구 일괄 점검

2순위:
중등 대화문 추출 속도 분석

3순위:
고등 국어 문단 구조 보존

4순위:
관리자 API 비용/사용량 추적

---

## 17. 새 ChatGPT 대화에서 시작 방법

새 대화에서 이 프로젝트를 이어갈 때 사용자에게
이미 설명한 내용을 다시 처음부터 묻지 말 것.

먼저 이 파일:

PROJECT_STATUS.md

를 읽고 현재 상태를 파악한 뒤 진행.

사용자가 별도로 보관 중인
"새 채팅용 인수인계문"이 있다면
그 내용과 PROJECT_STATUS.md를 함께 기준으로 삼기.

충돌 시:
1. 현재 실제 소스코드
2. PROJECT_STATUS.md
3. 과거 인수인계문

순서로 신뢰.

---

## 18. 절대 주의

- 고등 써밋네컷 안정된 화풍/이미지 프롬프트를 이유 없이 변경하지 말 것
- 고등 요약집의 현재 출력 여백을 다시 건드리지 말 것
- 이미지 비용이 드는 테스트는 최소 장수로 할 것
- 실제 현재 코드 확인 없이 패치하지 말 것
- 사용자가 이미 성공 확인한 기능을 다시 구조 변경하지 말 것
- 코드가 복잡해지면 더 단순한 대안을 먼저 생각할 것

