import 'package:flutter/material.dart';

import 'dashboard_screen.dart';

class ReportsScreen extends StatelessWidget {
  const ReportsScreen({
    super.key,
    required this.onSeeAllTransactions,
  });

  final VoidCallback onSeeAllTransactions;

  @override
  Widget build(BuildContext context) {
    return DashboardScreen(
      title: 'Báo cáo',
      showHomeSections: false,
      onSeeAllTransactions: onSeeAllTransactions,
    );
  }
}
