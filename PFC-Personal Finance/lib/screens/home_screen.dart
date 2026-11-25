import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../services/auth_service.dart';
import '../services/category_service.dart';
import '../widgets/responsive.dart';
import '../widgets/pfc_app_bar.dart';
import 'add_transaction_screen.dart';
import 'budget_screen.dart';
import 'dashboard_screen.dart';
import 'profile_screen.dart';
import 'saving_challenge_screen.dart';
import 'saving_goal_screen.dart';
import 'transaction_history_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _categoryService = CategoryService();
  final _authService = AuthService();
  int _tabIndex = 0;

  static const _destinations = [
    NavigationDestination(
      icon: Icon(Icons.dashboard_outlined),
      selectedIcon: Icon(Icons.dashboard),
      label: 'Trang chủ',
    ),
    NavigationDestination(
      icon: Icon(Icons.receipt_long_outlined),
      selectedIcon: Icon(Icons.receipt_long),
      label: 'Giao dịch',
    ),
    NavigationDestination(
      icon: Icon(Icons.account_balance_wallet_outlined),
      selectedIcon: Icon(Icons.account_balance_wallet),
      label: 'Ngân sách',
    ),
    NavigationDestination(
      icon: Icon(Icons.flag_outlined),
      selectedIcon: Icon(Icons.flag),
      label: 'Mục tiêu',
    ),
    NavigationDestination(
      icon: Icon(Icons.emoji_events_outlined),
      selectedIcon: Icon(Icons.emoji_events),
      label: 'Thử thách',
    ),
    NavigationDestination(
      icon: Icon(Icons.person_outline),
      selectedIcon: Icon(Icons.person),
      label: 'Tài khoản',
    ),
  ];

  @override
  void initState() {
    super.initState();
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid != null) {
      _categoryService.seedDefaultCategories(uid);
    }
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      DashboardScreen(
        onSeeAllTransactions: () => setState(() => _tabIndex = 1),
      ),
      _TransactionsTab(onSignOut: _authService.signOut),
      const BudgetScreen(),
      const SavingGoalScreen(),
      const SavingChallengeScreen(),
      const ProfileScreen(),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        final wide = constraints.maxWidth >= AppBreakpoints.medium;
        final content = IndexedStack(index: _tabIndex, children: pages);

        if (wide) {
          return Scaffold(
            body: Row(
              children: [
                NavigationRail(
                  extended: constraints.maxWidth >= 1100,
                  selectedIndex: _tabIndex,
                  onDestinationSelected: (index) {
                    setState(() => _tabIndex = index);
                  },
                  destinations: [
                    for (final item in _destinations)
                      NavigationRailDestination(
                        icon: item.icon,
                        selectedIcon: item.selectedIcon,
                        label: Text(item.label),
                      ),
                  ],
                ),
                const VerticalDivider(width: 1),
                Expanded(child: content),
              ],
            ),
          );
        }

        return Scaffold(
          body: content,
          bottomNavigationBar: NavigationBar(
            selectedIndex: _tabIndex,
            labelBehavior: NavigationDestinationLabelBehavior.onlyShowSelected,
            onDestinationSelected: (index) {
              setState(() => _tabIndex = index);
            },
            destinations: _destinations,
          ),
        );
      },
    );
  }
}

class _TransactionsTab extends StatelessWidget {
  const _TransactionsTab({required this.onSignOut});

  final Future<void> Function() onSignOut;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: PfcAppBar(
        title: const Text('Giao dịch'),
        actions: [
          IconButton(
            tooltip: 'Đăng xuất',
            onPressed: onSignOut,
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: const ResponsiveBody(
        child: TransactionHistoryScreen(embedded: true),
      ),
      floatingActionButton: FloatingActionButton(
        heroTag: 'fab-transactions',
        onPressed: () {
          Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => const AddTransactionScreen(),
            ),
          );
        },
        child: const Icon(Icons.add),
      ),
    );
  }
}
