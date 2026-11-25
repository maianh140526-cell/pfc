import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../services/category_service.dart';
import 'account_screen.dart';
import 'add_transaction_screen.dart';
import 'dashboard_screen.dart';
import 'more_screen.dart';
import 'reports_screen.dart';
import 'transaction_history_screen.dart';

class HomeNavigationScreen extends StatefulWidget {
  const HomeNavigationScreen({super.key});

  @override
  State<HomeNavigationScreen> createState() => _HomeNavigationScreenState();
}

class _HomeNavigationScreenState extends State<HomeNavigationScreen> {
  final _categoryService = CategoryService();
  late final List<Widget> _pages;
  int _tabIndex = 0;

  @override
  void initState() {
    super.initState();
    _pages = [
      DashboardScreen(
        onSeeAllTransactions: _openTransactionHistory,
      ),
      const AccountScreen(),
      ReportsScreen(
        onSeeAllTransactions: _openTransactionHistory,
      ),
      const MoreScreen(),
    ];

    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid != null) {
      _categoryService.seedDefaultCategories(uid);
    }
  }

  void _openAddTransaction() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => const AddTransactionScreen(),
      ),
    );
  }

  void _openTransactionHistory() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => const TransactionHistoryScreen(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBody: true,
      body: IndexedStack(index: _tabIndex, children: _pages),
      bottomNavigationBar: _FinanceBottomNavigation(
        selectedIndex: _tabIndex,
        onDestinationSelected: (index) {
          setState(() => _tabIndex = index);
        },
        onAddPressed: _openAddTransaction,
      ),
    );
  }
}

class _FinanceBottomNavigation extends StatelessWidget {
  const _FinanceBottomNavigation({
    required this.selectedIndex,
    required this.onDestinationSelected,
    required this.onAddPressed,
  });

  final int selectedIndex;
  final ValueChanged<int> onDestinationSelected;
  final VoidCallback onAddPressed;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final bottomPadding = MediaQuery.paddingOf(context).bottom;

    return SizedBox(
      height: 88 + bottomPadding,
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.topCenter,
        children: [
          Positioned.fill(
            top: 16,
            child: Material(
              color: colorScheme.surface,
              elevation: 8,
              child: SafeArea(
                top: false,
                child: Row(
                  children: [
                    _NavigationItem(
                      label: 'Trang chủ',
                      icon: Icons.home_outlined,
                      selectedIcon: Icons.home,
                      isSelected: selectedIndex == 0,
                      onTap: () => onDestinationSelected(0),
                    ),
                    _NavigationItem(
                      label: 'Tài khoản',
                      icon: Icons.account_balance_wallet_outlined,
                      selectedIcon: Icons.account_balance_wallet,
                      isSelected: selectedIndex == 1,
                      onTap: () => onDestinationSelected(1),
                    ),
                    const Expanded(child: SizedBox()),
                    _NavigationItem(
                      label: 'Báo cáo',
                      icon: Icons.bar_chart_outlined,
                      selectedIcon: Icons.bar_chart,
                      isSelected: selectedIndex == 2,
                      onTap: () => onDestinationSelected(2),
                    ),
                    _NavigationItem(
                      label: 'Khác',
                      icon: Icons.grid_view_outlined,
                      selectedIcon: Icons.grid_view,
                      isSelected: selectedIndex == 3,
                      onTap: () => onDestinationSelected(3),
                    ),
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            top: 0,
            child: FloatingActionButton(
              heroTag: 'main-add-transaction',
              tooltip: 'Thêm giao dịch',
              onPressed: onAddPressed,
              shape: const CircleBorder(),
              child: const Icon(Icons.add),
            ),
          ),
        ],
      ),
    );
  }
}

class _NavigationItem extends StatelessWidget {
  const _NavigationItem({
    required this.label,
    required this.icon,
    required this.selectedIcon,
    required this.isSelected,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final IconData selectedIcon;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final color =
        isSelected ? colorScheme.primary : colorScheme.onSurfaceVariant;

    return Expanded(
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(4, 12, 4, 6),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(isSelected ? selectedIcon : icon, color: color),
              const SizedBox(height: 3),
              FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  label,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: color,
                        fontWeight:
                            isSelected ? FontWeight.w600 : FontWeight.normal,
                      ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
