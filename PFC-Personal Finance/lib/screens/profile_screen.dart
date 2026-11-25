import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/user_model.dart';
import '../services/auth_service.dart';
import '../widgets/responsive.dart';
import '../widgets/pfc_app_bar.dart';
import 'change_password_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _authService = AuthService();
  late final Future<UserModel?> _userFuture;

  @override
  void initState() {
    super.initState();
    _userFuture = _authService.getCurrentUser();
  }

  @override
  Widget build(BuildContext context) {
    final authUser = FirebaseAuth.instance.currentUser;

    return Scaffold(
      appBar: const PfcAppBar(title: Text('Tài khoản')),
      body: FutureBuilder<UserModel?>(
        future: _userFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const LoadingView();
          }
          if (snapshot.hasError) {
            return ErrorView(
                message: 'Không tải được hồ sơ.\n${snapshot.error}');
          }

          final profile = snapshot.data;
          final name = (profile?.name.isNotEmpty ?? false)
              ? profile!.name
              : (authUser?.displayName ?? 'Chưa có tên');
          final email = (profile?.email.isNotEmpty ?? false)
              ? profile!.email
              : (authUser?.email ?? 'Không có email');
          final createdAt =
              profile?.createdAt ?? authUser?.metadata.creationTime;

          return ResponsiveBody(
            maxWidth: 560,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const SizedBox(height: 12),
                CircleAvatar(
                  radius: 40,
                  child: Text(
                    name.isNotEmpty ? name[0].toUpperCase() : '?',
                    style: const TextStyle(fontSize: 32),
                  ),
                ),
                const SizedBox(height: 16),
                ListTile(
                  leading: const Icon(Icons.person_outline),
                  title: const Text('Tên'),
                  subtitle: Text(name),
                ),
                ListTile(
                  leading: const Icon(Icons.email_outlined),
                  title: const Text('Email'),
                  subtitle: Text(email),
                ),
                ListTile(
                  leading: const Icon(Icons.badge_outlined),
                  title: const Text('Mã người dùng'),
                  subtitle: Text(authUser?.uid ?? profile?.uid ?? '—'),
                ),
                ListTile(
                  leading: const Icon(Icons.calendar_month_outlined),
                  title: const Text('Ngày tạo tài khoản'),
                  subtitle: Text(
                    createdAt == null
                        ? '—'
                        : DateFormat('dd/MM/yyyy HH:mm').format(createdAt),
                  ),
                ),
                const SizedBox(height: 12),
                ListTile(
                  leading: const Icon(Icons.lock_outline),
                  title: const Text('Đổi mật khẩu'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => const ChangePasswordScreen(),
                      ),
                    );
                  },
                ),
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: () => _authService.signOut(),
                  icon: const Icon(Icons.logout),
                  label: const Text('Đăng xuất'),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
