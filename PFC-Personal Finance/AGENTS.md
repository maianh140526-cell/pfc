# AGENTS.md — PFC Personal Finance (Quỹ)

Bạn đang làm việc trong **Personal Finance zone** của PFC Digital Hub — app Flutter + Firebase ([upstream](https://github.com/buiductiendung06-crypto/finance_app)).

Bounded module: **không** import Club Management / Opportunity Hub internals. Identity dài hạn nên gắn Platform `member_id` khi có SSO; hiện tại app dùng Firebase Auth riêng.

## Non-negotiables

1. Đây là zone **Personal Finance** trong hub (`MANAGE → LEARN → BUILD → EARN → GROW → CONTRIBUTE`), không phải sản phẩm SaaS riêng tách brand.
2. Không bịa rule tài chính / thuế ngoài SRS hoặc disclaimer hiện có trong README.
3. Secrets: không commit service account / `.env` / keystore; `firebase_options.dart` chỉ client config (chạy `flutterfire configure` trên máy có quyền Firebase).
4. Không kéo Club Event/ticketing/payment vào module này trừ khi SRS giao rõ.
5. UI/tooling tính toán chỉ mang tính tham khảo (đã ghi trong README).

## Chạy local

```bash
cd "PFC-Personal Finance"
flutter pub get
flutter run -d chrome   # hoặc thiết bị Android
flutter test
```

Yêu cầu: Flutter SDK ^3.6, Firebase project đã cấu hình Auth + Firestore.

## Cấu trúc nhanh

| Path | Vai trò |
|------|---------|
| `lib/screens/` | UI màn hình |
| `lib/services/` | Auth, transaction, budget, goals… |
| `lib/models/` | Model dữ liệu |
| `lib/theme/` | Brand PFC |
| `firestore.rules` | Rules Firestore |

## Upstream

- Repo nguồn: https://github.com/buiductiendung06-crypto/finance_app  
- Đã vendored vào monorepo (không giữ `.git` lồng). Khi sync lại: pull upstream rồi copy thay đổi có kiểm soát — tránh ghi đè chỉnh sửa local không commit.
