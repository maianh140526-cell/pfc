import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../models/user_model.dart';
import 'category_service.dart';

class AuthException implements Exception {
  AuthException(this.message);
  final String message;

  @override
  String toString() => message;
}

class AuthService {
  AuthService({
    FirebaseAuth? auth,
    FirebaseFirestore? firestore,
  })  : _auth = auth ?? FirebaseAuth.instance,
        _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseAuth _auth;
  final FirebaseFirestore _firestore;

  Future<UserModel> signUp({
    required String email,
    required String password,
    required String name,
  }) async {
    try {
      final credential = await _auth.createUserWithEmailAndPassword(
        email: email.trim(),
        password: password,
      );
      final user = credential.user;
      if (user == null) {
        throw AuthException('Không tạo được tài khoản. Vui lòng thử lại.');
      }

      await user.updateDisplayName(name.trim());

      final userModel = UserModel(
        uid: user.uid,
        name: name.trim(),
        email: user.email ?? email.trim(),
        createdAt: DateTime.now(),
      );

      await _firestore.collection('users').doc(user.uid).set(userModel.toMap());
      await CategoryService().seedDefaultCategories(user.uid);
      return userModel;
    } on FirebaseAuthException catch (e) {
      throw AuthException(_messageFromCode(e.code, e.message));
    } on FirebaseException catch (e) {
      throw AuthException(_messageFromCode(e.code, e.message));
    } on AuthException {
      rethrow;
    } catch (e) {
      throw AuthException(_messageFromUnknown(e));
    }
  }

  Future<UserModel> signIn({
    required String email,
    required String password,
  }) async {
    try {
      final credential = await _auth.signInWithEmailAndPassword(
        email: email.trim(),
        password: password,
      );
      final user = credential.user;
      if (user == null) {
        throw AuthException('Đăng nhập thất bại. Vui lòng thử lại.');
      }

      await CategoryService().seedDefaultCategories(user.uid);

      return await getCurrentUser() ??
          UserModel(
            uid: user.uid,
            name: user.displayName ?? '',
            email: user.email ?? email.trim(),
            createdAt: user.metadata.creationTime ?? DateTime.now(),
          );
    } on FirebaseAuthException catch (e) {
      throw AuthException(_messageFromCode(e.code, e.message));
    } on FirebaseException catch (e) {
      throw AuthException(_messageFromCode(e.code, e.message));
    } on AuthException {
      rethrow;
    } catch (e) {
      throw AuthException(_messageFromUnknown(e));
    }
  }

  Future<void> signOut() async {
    await _auth.signOut();
  }

  Future<void> changePassword(
    String currentPassword,
    String newPassword,
  ) async {
    if (newPassword.length < 6) {
      throw AuthException(
        'Mật khẩu mới quá yếu, vui lòng chọn mật khẩu khác.',
      );
    }

    try {
      final currentUser = _auth.currentUser;
      final email = currentUser?.email;
      if (currentUser == null || email == null || email.isEmpty) {
        throw AuthException('Đã xảy ra lỗi. Vui lòng thử lại.');
      }

      final credential = EmailAuthProvider.credential(
        email: email,
        password: currentPassword,
      );
      await currentUser.reauthenticateWithCredential(credential);
      await currentUser.updatePassword(newPassword);
    } on FirebaseAuthException catch (e) {
      switch (e.code) {
        case 'wrong-password':
        case 'invalid-credential':
        case 'invalid-login-credentials':
          throw AuthException('Mật khẩu hiện tại không đúng.');
        case 'weak-password':
          throw AuthException(
            'Mật khẩu mới quá yếu, vui lòng chọn mật khẩu khác.',
          );
        default:
          throw AuthException('Đã xảy ra lỗi. Vui lòng thử lại.');
      }
    } on AuthException {
      rethrow;
    } catch (_) {
      throw AuthException('Đã xảy ra lỗi. Vui lòng thử lại.');
    }
  }

  Future<void> resetPassword(String email) async {
    try {
      await _auth.sendPasswordResetEmail(email: email.trim());
    } on FirebaseAuthException catch (e) {
      // Do not reveal whether an account exists for the supplied email.
      if (e.code == 'user-not-found') return;
      if (e.code == 'invalid-email' || e.code == 'missing-email') {
        throw AuthException('Email không đúng định dạng.');
      }
      throw AuthException(_messageFromCode(e.code, e.message));
    } catch (e) {
      throw AuthException(_messageFromUnknown(e));
    }
  }

  Future<UserModel?> getCurrentUser() async {
    final user = _auth.currentUser;
    if (user == null) return null;

    final snapshot = await _firestore.collection('users').doc(user.uid).get();
    final data = snapshot.data();
    if (data != null) {
      return UserModel.fromMap(data);
    }

    return UserModel(
      uid: user.uid,
      name: user.displayName ?? '',
      email: user.email ?? '',
      createdAt: user.metadata.creationTime ?? DateTime.now(),
    );
  }

  String _messageFromCode(String code, [String? detail]) {
    final normalized = code.toLowerCase();
    if (normalized.contains('api-key') ||
        normalized.contains('app-not-authorized') ||
        normalized.contains('configuration-not-found')) {
      return 'App chưa kết nối đúng project Firebase. '
          'Hãy chạy flutterfire configure rồi khởi động lại app.';
    }

    switch (code) {
      case 'email-already-in-use':
        return 'Email này đã được đăng ký. Hãy đăng nhập hoặc dùng email khác.';
      case 'invalid-email':
        return 'Email không hợp lệ.';
      case 'weak-password':
        return 'Mật khẩu quá yếu. Hãy dùng ít nhất 6 ký tự.';
      case 'user-not-found':
        return 'Không tìm thấy tài khoản với email này.';
      case 'wrong-password':
        return 'Sai mật khẩu. Vui lòng thử lại.';
      case 'invalid-credential':
      case 'invalid-login-credentials':
        return 'Email hoặc mật khẩu không đúng.';
      case 'user-disabled':
        return 'Tài khoản này đã bị khóa.';
      case 'too-many-requests':
        return 'Bạn đã thử quá nhiều lần. Hãy đợi một lúc rồi thử lại.';
      case 'network-request-failed':
        return 'Lỗi mạng. Kiểm tra kết nối internet và thử lại.';
      case 'operation-not-allowed':
        return 'Đăng nhập bằng email/mật khẩu chưa được bật trên Firebase.';
      case 'missing-password':
        return 'Vui lòng nhập mật khẩu.';
      case 'missing-email':
        return 'Vui lòng nhập email.';
      case 'permission-denied':
        return 'Firestore đang chặn ghi dữ liệu. Kiểm tra Rules (users, categories, transactions).';
      default:
        final extra =
            (detail != null && detail.trim().isNotEmpty) ? ' $detail' : '';
        return 'Đã xảy ra lỗi ($code).$extra';
    }
  }

  String _messageFromUnknown(Object error) {
    final text = error.toString().toLowerCase();
    if (text.contains('api-key') || text.contains('api key')) {
      return 'App chưa kết nối đúng project Firebase. '
          'Hãy chạy flutterfire configure rồi khởi động lại app.';
    }
    return 'Đã xảy ra lỗi. Vui lòng thử lại.';
  }
}
