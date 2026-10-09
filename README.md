# Zenith 프로젝트 포트폴리오

GitHub Pages와 Jekyll로 공개 프로젝트의 설명·최초 개발일·기술·소스 갱신일·릴리즈 버전을 소개합니다.

- 홈페이지: https://dkdleljh.github.io/
- 프로그램 목록: https://dkdleljh.github.io/projects/
- 원본 데이터: GitHub 공개 저장소 description 및 최신 정식 Release
- 공통 카탈로그: `_data/projects.json`
- 최초 개발일 근거: `_data/project_history.json`의 최초 커밋 SHA와 작성일
- 프로젝트 상세 목록은 `/projects/` 한곳에서 관리하며 홈과 Links는 이 페이지로 안내합니다.
- 날짜 표시: 한국 시간(Asia/Seoul)

## 갱신

저장소 설명은 GitHub About의 Description에서, 버전과 변경사항은 GitHub Release에서 관리합니다.
`main` 푸시·수동 실행·6시간 주기에 카탈로그를 갱신하고 같은 워크플로우에서 Jekyll 빌드 및 Pages 배포를 완료합니다.

로컬에서 확인하려면 GitHub CLI 인증 후 다음을 실행합니다.

```bash
USE_GH_CLI=1 python3 .github/scripts/update_repos.py
python3 -m unittest discover -s tests -v
```

`--check` 옵션은 갱신 필요 여부만 검사합니다. API 오류나 잘못된 최초 커밋 정보가 있으면 저장 전에 중단합니다.
최초 개발일은 shallow clone이 아닌 전체 Git 이력에서 루트 커밋을 확인하고,
그중 가장 이른 작성일을 한국 시간으로 변환한 값입니다. 근거 SHA는 GitHub에서 부모 없는 커밋인지 검증했습니다.
신규 저장소의 이력을 아직 확인하지 않았다면 날짜를 추정하지 않고 확인 중으로 표시합니다.
이력 재작성·이전 시에는 `_data/project_history.json`을 다시 검증하고 갱신하세요.

비공개·다른 소유자·포크·보관된 저장소는 공개 카탈로그에서 제외합니다.

로컬 작업 폴더의 자동 pull은 이 사이트와 별도인 사용자 컴퓨터의 `github-desktop-sync.timer`에서 관리합니다.
작업 중인 변경사항과 로컬 전용 커밋은 자동 push하지 않습니다.

<!-- BEGIN RELEASE STATUS -->
## 최신 배포 정보

- 저장소 버전: `v1.0.2`
- [변경사항과 검증 범위](RELEASE_NOTES.md)
- [GitHub 릴리즈](https://github.com/dkdleljh/dkdleljh.github.io/releases/latest)
<!-- END RELEASE STATUS -->
