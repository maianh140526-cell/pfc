# PFC Quỹ — Personal Finance zone

Ứng dụng quản lý tài chính cá nhân (Flutter + Firebase) trong **PFC Digital Hub**.

| | |
|--|--|
| **Vị trí monorepo** | `PFC-Personal Finance/` |
| **Upstream** | [buiductiendung06-crypto/finance_app](https://github.com/buiductiendung06-crypto/finance_app) |
| **Agent notes** | [AGENTS.md](./AGENTS.md) |

## Chức năng chính

- Đăng ký, đăng nhập và đổi mật khẩu bằng Firebase Authentication.
- Quản lý giao dịch, ngân sách và báo cáo thu chi.
- Mục tiêu và thử thách tiết kiệm.
- Công cụ tài chính: lãi kép, khoản vay, kế hoạch nghỉ hưu, so sánh lãi suất và thuế TNCN.
- Hỗ trợ Flutter Web và Android.

## Chạy dự án

```bash
flutter pub get
flutter run -d chrome
```

Chạy kiểm thử:

```bash
flutter test
```

## Firebase

Project sử dụng Firebase Authentication và Cloud Firestore. Cấu hình nền tảng nằm trong `lib/firebase_options.dart`, `android/app/google-services.json` và `firebase.json`.

> Các công cụ tính toán tài chính chỉ mang tính tham khảo, không thay thế tư vấn tài chính, đầu tư hoặc thuế chính thức.
