---
layout: page
title: Projects
permalink: /projects/
---

# 프로젝트

공개 프로젝트 **{{ site.data.projects | size }}개**의 기능과 최신 정식 릴리즈를 소개합니다. 프로젝트별 사용설명서와 배포 파일은 아래 링크에서 확인할 수 있습니다.

**최초 개발일**은 현재 Git 이력에서 확인되는 최초 커밋의 작성일을 한국 시간으로 표시한 날짜입니다. Git에 기록하기 전의 실제 개발 시작일과는 다를 수 있으며, 각 날짜 옆에서 근거 커밋을 확인할 수 있습니다.

{% for project in site.data.projects %}
<section class="project-entry" id="{{ project.name | slugify }}">
  <h2>{{ project.name | escape }}</h2>
  <p>{{ project.description | escape }}</p>
  <ul>
    {% if project.development_date %}
    <li>최초 개발일: <time datetime="{{ project.development_date }}">{{ project.development_date }}</time> · <a href="{{ project.first_commit_url | escape }}">최초 커밋</a>{% if project.date_note %}<br>{{ project.date_note | escape }}{% endif %}</li>
    {% else %}
    <li>최초 개발일: Git 이력 확인 중</li>
    {% endif %}
    <li>주요 언어: {{ project.language | escape }}</li>
    <li>소스 업데이트: {{ project.source_date }}</li>
    {% if project.version %}
    <li>최신 버전: <a href="{{ project.release_url | escape }}">{{ project.version | escape }}</a> · {{ project.release_date }}</li>
    {% else %}
    <li>최신 버전: 아직 정식 릴리즈가 등록되지 않았습니다.</li>
    {% endif %}
    <li><a href="{{ project.url | escape }}">저장소 · 사용설명서</a> · <a href="{{ project.url | escape }}/releases">릴리즈 · 다운로드</a></li>
  </ul>
</section>
{% endfor %}

## 업데이트 방식

저장소의 최신 소개와 정식 릴리즈를 6시간마다 확인해 반영합니다. 이 사이트를 수정할 때도 함께 갱신합니다. 버전은 배포 기록이며, 서비스의 현재 실행 상태를 뜻하지 않습니다.
