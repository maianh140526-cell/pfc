import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../models/user_model.dart';
import '../services/auth_service.dart';
import '../widgets/responsive.dart';
import '../widgets/pfc_app_bar.dart';
import 'financial_tools_screen.dart';
import 'profile_screen.dart';
import 'saving_challenge_screen.dart';
import 'saving_goal_screen.dart';
import 'transaction_history_screen.dart';

class MoreScreen extends StatefulWidget {
  const MoreScreen({super.key});

  @override
  State<MoreScreen> createState() => _MoreScreenState();
}

class _MoreScreenState extends State<MoreScreen> {
  final _authService = AuthService();
  late final Future<UserModel?> _userFuture;

  @override
  void initState() {
    super.initState();
    _userFuture = _authService.getCurrentUser();
  }

  void _open(Widget screen) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => screen),
    );
  }

  @override
  Widget build(BuildContext context) {
    final authUser = FirebaseAuth.instance.currentUser;

    return Scaffold(
      appBar: const PfcAppBar(title: Text('Khác')),
      body: ResponsiveBody(
        maxWidth: 820,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 112),
          children: [
            FutureBuilder<UserModel?>(
              future: _userFuture,
              builder: (context, snapshot) {
                final profile = snapshot.data;
                final name = (profile?.name.isNotEmpty ?? false)
                    ? profile!.name
                    : (authUser?.displayName ?? 'Người dùng');
                final email = (profile?.email.isNotEmpty ?? false)
                    ? profile!.email
                    : (authUser?.email ?? '');

                return Card(
                  child: ListTile(
                    contentPadding: const EdgeInsets.all(16),
                    leading: CircleAvatar(
                      radius: 28,
                      child: Text(
                        name.isNotEmpty ? name[0].toUpperCase() : '?',
                        style: const TextStyle(fontSize: 22),
                      ),
                    ),
                    title: Text(
                      name,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    subtitle: email.isEmpty ? null : Text(email),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => _open(const ProfileScreen()),
                  ),
                );
              },
            ),
            const SizedBox(height: 16),
            LayoutBuilder(
              builder: (context, constraints) {
                final columns = constraints.maxWidth >= 640 ? 3 : 2;
                return GridView.count(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisCount: columns,
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 12,
                  childAspectRatio: 1.25,
                  children: [
                    _MoreItem(
                      icon: Icons.flag_outlined,
                      label: 'Mục tiêu tiết kiệm',
                      onTap: () => _open(const SavingGoalScreen()),
                    ),
                    _MoreItem(
                      icon: Icons.emoji_events_outlined,
                      label: 'Thử thách tiết kiệm',
                      onTap: () => _open(const SavingChallengeScreen()),
                    ),
                    _MoreItem(
                      icon: Icons.receipt_long_outlined,
                      label: 'Lịch sử giao dịch',
                      onTap: () => _open(const TransactionHistoryScreen()),
                    ),
                    _MoreItem(
                      icon: Icons.calculate_outlined,
                      label: 'Công cụ tài chính',
                      onTap: () => _open(const FinancialToolsScreen()),
                    ),
                    _MoreItem(
                      icon: Icons.logout,
                      label: 'Đăng xuất',
                      color: Theme.of(context).colorScheme.error,
                      onTap: _authService.signOut,
                    ),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _MoreItem extends StatelessWidget {
  const _MoreItem({
    required this.icon,
    required this.label,
    required this.onTap,
    this.color,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final itemColor = color ?? Theme.of(context).colorScheme.primary;

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 32, color: itemColor),
              const SizedBox(height: 10),
              Text(
                label,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: itemColor),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
