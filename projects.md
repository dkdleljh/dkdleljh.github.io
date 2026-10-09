---
layout: page
title: Projects
permalink: /projects/
---

# 프로젝트

직접 개발하고 관리하는 공개 프로그램과 실험 프로젝트입니다. 각 저장소의 설명과 최신 정식 릴리즈를 모아 소개합니다. 아래 버전은 배포 기록을 뜻하며, 서비스의 현재 실행 여부를 뜻하지 않습니다.

## 프로그램 목록

{% for project in site.data.projects %}
### {{ project.name | escape }}

{{ project.description | escape }}

- 기술: {{ project.language | escape }}
- 소스 업데이트: {{ project.source_date }}
{% if project.version %}
- 최신 버전: [{{ project.version | escape }}]({{ project.release_url }}) · {{ project.release_date }}
{% else %}
- 최신 버전: 아직 정식 릴리즈가 등록되지 않았습니다.
{% endif %}
- [소스와 사용설명서]({{ project.url }}) · [전체 릴리즈]({{ project.url }}/releases)

{% endfor %}

## 업데이트 방식

GitHub 저장소의 설명과 정식 릴리즈를 기준으로 이 목록을 자동 갱신합니다. 변경사항은 6시간 주기로 반영되며, 소개 페이지 저장소를 업데이트할 때도 다시 확인합니다. 비공개 저장소의 코드와 내부 문서는 공개 목록에 포함하지 않습니다.
