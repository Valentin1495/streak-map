# Reverse Geocoding

Naver Cloud Maps Reverse Geocoding API는 입력한 좌표를 주소 정보로 변환한다. 법정동, 행정동, 지번 주소, 도로명 주소를 조회할 수 있다.

## Endpoint

```http
GET https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc
```

문서상 URI는 `/gc`이며, 전체 호출 URL은 위 호스트와 조합한다.

## Headers

```http
x-ncp-apigw-api-key-id: {API Key ID}
x-ncp-apigw-api-key: {API Key}
```

## Query Parameters

| Name        | Type     | Required | Default             | Description                                                                                |
| ----------- | -------- | -------- | ------------------- | ------------------------------------------------------------------------------------------ |
| `coords`    | `string` | yes      | -                   | 좌표. `X,Y` 형식이다. `EPSG:4326`에서는 `longitude,latitude` 순서다. 예: `127.585,34.9765` |
| `sourcecrs` | `string` | no       | `EPSG:4326`         | 입력 좌표계. `EPSG:4326`, `EPSG:3857`, `NHN:2048`                                          |
| `targetcrs` | `string` | no       | `EPSG:4326`         | 출력 좌표계. `EPSG:4326`, `EPSG:3857`, `NHN:2048`                                          |
| `orders`    | `string` | no       | `legalcode,admcode` | 변환 타입. 콤마로 여러 값을 지정하며 입력 순서대로 결과가 반환된다.                        |
| `output`    | `string` | no       | `xml`               | 응답 포맷. `xml` 또는 `json`                                                               |
| `callback`  | `string` | no       | -                   | JSONP 콜백 이름. `output=json`일 때만 사용한다.                                            |

## Coordinate Systems

| Code        | Description        |
| ----------- | ------------------ |
| `EPSG:4326` | WGS84 경위도       |
| `EPSG:3857` | Google Maps 좌표계 |
| `NHN:2048`  | UTM-K              |

## Orders

| Value       | Description        |
| ----------- | ------------------ |
| `legalcode` | 법정동으로 변환    |
| `admcode`   | 행정동으로 변환    |
| `addr`      | 지번 주소로 변환   |
| `roadaddr`  | 도로명 주소로 변환 |

해안선 부근, 신규 택지, 바다 위 좌표처럼 상세 주소가 없거나 모호한 지역에서는 `addr` 또는 `roadaddr` 결과가 없을 수 있다. 이 경우 `legalcode` 또는 `admcode`를 함께 요청하면 동 단위 주소를 얻을 가능성이 높다.

## Request Example

```bash
curl --location --request GET \
  'https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc?coords=127.585%2C34.9765&output=json&orders=legalcode%2Cadmcode%2Caddr%2Croadaddr' \
  --header 'x-ncp-apigw-api-key-id: {API Key ID}' \
  --header 'x-ncp-apigw-api-key: {API Key}'
```

일반적으로 앱에서는 다음처럼 URL을 구성한다.

```ts
const params = new URLSearchParams({
  coords: `${longitude},${latitude}`,
  sourcecrs: 'EPSG:4326',
  targetcrs: 'EPSG:4326',
  orders: 'admcode,legalcode,addr,roadaddr',
  output: 'json',
});

const url = `https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc?${params}`;
```

## Response Shape

JSON 응답의 최상위 구조는 다음과 같다.

```ts
type ReverseGeocodingResponse = {
  status: {
    code: number;
    name: string;
    message: string;
  };
  results?: ReverseGeocodingResult[];
};

type ReverseGeocodingResult = {
  name: 'legalcode' | 'admcode' | 'addr' | 'roadaddr';
  code?: {
    id?: string;
    type?: 'L' | 'A' | 'S';
    mappingId?: string;
  };
  region?: {
    area0?: RegionArea;
    area1?: RegionArea;
    area2?: RegionArea;
    area3?: RegionArea;
    area4?: RegionArea;
  };
  land?: {
    type?: string;
    name?: string;
    number1?: string;
    number2?: string;
    coords?: Coords;
    addition0?: LandAddition;
    addition1?: LandAddition;
    addition2?: LandAddition;
    addition3?: LandAddition;
    addition4?: LandAddition;
  };
};

type RegionArea = {
  name?: string;
  alias?: string;
  coords?: Coords;
};

type Coords = {
  center?: {
    crs?: string;
    x?: number;
    y?: number;
  };
};

type LandAddition = {
  type?: string;
  value?: string;
};
```

## Response Fields

### `status`

| Field            | Description   |
| ---------------- | ------------- |
| `status.code`    | API 상태 코드 |
| `status.name`    | 상태 메시지   |
| `status.message` | 상태 설명     |

### `results`

| Field                        | Description                                                                                    |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| `name`                       | 변환 타입. `legalcode`, `admcode`, `addr`, `roadaddr` 중 하나                                  |
| `code.id`                    | 법정/행정 코드 ID                                                                              |
| `code.type`                  | 코드 타입. `L`: 법정동, `A`: 행정동, `S`: 영역은 다르지만 같은 이름의 법정동이 존재하는 행정동 |
| `code.mappingId`             | 법정/행정 코드에 매핑된 네이버 동 코드 ID                                                      |
| `region.area0.name`          | 국가 코드. 보통 `kr`                                                                           |
| `region.area1.name`          | 시/도                                                                                          |
| `region.area2.name`          | 시/군/구                                                                                       |
| `region.area3.name`          | 읍/면/동                                                                                       |
| `region.area4.name`          | 리                                                                                             |
| `region.areaN.coords.center` | 행정구역 중심 좌표                                                                             |
| `land.type`                  | 지적 타입. `addr` 결과에서 사용. `1`: 일반 토지, `2`: 산                                       |
| `land.name`                  | 도로명. `roadaddr` 결과에서 사용                                                               |
| `land.number1`               | `addr`에서는 토지 본번호, `roadaddr`에서는 상세 주소 번호                                      |
| `land.number2`               | `addr`에서 토지 부번호                                                                         |
| `land.coords.center`         | 상세 주소 중심 좌표                                                                            |

`EPSG:4326` 좌표에서는 `center.x`가 경도, `center.y`가 위도다.

### Road Address Additions

`roadaddr` 결과에서 추가 정보가 포함될 수 있다.

| Field            | Type            | Description      |
| ---------------- | --------------- | ---------------- |
| `land.addition0` | `building`      | 건물 이름        |
| `land.addition1` | `zipcode`       | 우편번호         |
| `land.addition2` | `roadGroupCode` | 12자리 도로 코드 |

## Status Codes

| HTTP Status | API Code | Name                       | Description                    |
| ----------- | -------: | -------------------------- | ------------------------------ |
| `200`       |      `0` | `ok`                       | 요청 처리 성공. 응답 결과 반환 |
| `200`       |      `3` | `no results`               | 요청 처리 성공. 응답 결과 없음 |
| `400`       |    `100` | `invalid request`          | 요청 파라미터 오류             |
| `500`       |    `900` | `unknown error / io error` | 정의되지 않은 오류             |

## Notes for Implementation

- 한국 좌표를 주소로 바꿀 때는 `sourcecrs=EPSG:4326`, `output=json`을 명시하는 편이 안전하다.
- 현재 위치 값이 `latitude`, `longitude`로 제공되는 경우 `coords`에는 반드시 `longitude,latitude` 순서로 넣는다.
- 화면 표시용 주소는 보통 `roadaddr`를 우선 사용하고, 없으면 `addr`, 그마저 없으면 `admcode` 또는 `legalcode`의 `region` 조합으로 fallback한다.
- `results`가 비어 있거나 `status.code === 3`일 수 있으므로 실패가 아닌 "주소 없음" 상태로 처리한다.
