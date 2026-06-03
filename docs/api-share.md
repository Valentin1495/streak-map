---
url: 'https://developers-apps-in-toss.toss.im/unity/sdk/api-share.md'
description: '앱인토스 Unity SDK의 공유 API 레퍼런스예요. 공유 링크 생성, 연락처 바이럴 등을 안내해요.'
---

# 공유

토스 공유 링크 생성, 연락처 기반 바이럴, 콘텐츠 공유 등의 API예요.

---

## API

| API                      | 반환 타입       | 설명                          |
| ------------------------ | --------------- | ----------------------------- |
| `AIT.Share()`            | `void`          | 콘텐츠를 공유해요             |
| `AIT.GetTossShareLink()` | `string`        | 토스 공유 링크를 생성해요     |
| `AIT.ContactsViral()`    | `Action` (구독) | 연락처 기반 바이럴을 실행해요 |

---

## Share

콘텐츠를 공유해요. OS 기본 공유 시트가 표시돼요.

```csharp
try
{
    await AIT.Share(new ShareMessage
    {
        // 공유할 메시지 내용
    });
    Debug.Log("공유 완료");
}
catch (AITException ex)
{
    Debug.LogError($"공유 실패: {ex.Message}");
}
```

---

## GetTossShareLink

딥링크 경로를 포함한 토스 공유 링크를 생성해요. 생성된 링크를 통해 다른 사용자가 미니앱의 특정 화면으로 바로 진입할 수 있어요.

```csharp
try
{
    // intoss://로 시작하는 딥링크 경로
    string shareLink = await AIT.GetTossShareLink(
        path: "intoss://my-app/invite",
        ogImageUrl: "https://example.com/og-image.png" // 선택
    );
    Debug.Log($"공유 링크: {shareLink}");
}
catch (AITException ex)
{
    Debug.LogError($"공유 링크 생성 실패: {ex.Message}");
}
```

| 파라미터     | 타입     | 필수 | 설명                               |
| ------------ | -------- | ---- | ---------------------------------- |
| `path`       | `string` | O    | `intoss://`로 시작하는 딥링크 경로 |
| `ogImageUrl` | `string` | X    | 공유 시 표시될 OG 이미지 URL       |

---

## ContactsViral

연락처 기반 바이럴을 실행해요. 구독 기반으로 이벤트 콜백을 통해 결과를 받아요.

```csharp
Action unsubscribe = AIT.ContactsViral(
    options: new ContactsViralParamsOptions
    {
        // 바이럴 옵션
    },
    onEvent: (result) =>
    {
        Debug.Log($"바이럴 이벤트: {result.Type}");
    },
    onError: (error) =>
    {
        Debug.LogError($"바이럴 실패: {error.ErrorCode} - {error.Message}");
    }
);

// 구독 해제
// unsubscribe();
```

::: tip

- 구독 기반 API는 `OnDestroy`에서 반드시 구독을 해제해 주세요.
  :::
