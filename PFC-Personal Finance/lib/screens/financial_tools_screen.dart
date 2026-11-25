import 'package:flutter/material.dart';

import '../widgets/responsive.dart';
import '../widgets/pfc_app_bar.dart';
import 'compound_interest_screen.dart';
import 'interest_rate_comparison_screen.dart';
import 'loan_calculator_screen.dart';
import 'personal_income_tax_screen.dart';
import 'retirement_plan_screen.dart';

class FinancialToolsScreen extends StatelessWidget {
  const FinancialToolsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const PfcAppBar(title: Text('Công cụ tài chính')),
      body: ResponsiveBody(
        maxWidth: 820,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _ToolItem(
              icon: Icons.trending_up,
              label: 'Tính lãi kép',
              description: 'Ước tính giá trị tương lai',
              onTap: () => _open(context, const CompoundInterestScreen()),
            ),
            const SizedBox(height: 10),
            _ToolItem(
              icon: Icons.account_balance_outlined,
              label: 'Tính khoản vay trả góp',
              description: 'Tính khoản vay trả góp hàng tháng',
              onTap: () => _open(context, const LoanCalculatorScreen()),
            ),
            const SizedBox(height: 10),
            _ToolItem(
              icon: Icons.beach_access_outlined,
              label: 'Kế hoạch nghỉ hưu',
              description: 'Tính mục tiêu và lợi suất cần thiết',
              onTap: () => _open(context, const RetirementPlanScreen()),
            ),
            const SizedBox(height: 10),
            _ToolItem(
              icon: Icons.compare_arrows,
              label: 'So sánh lãi suất ngân hàng',
              description: 'Cập nhật lãi suất mới nhất',
              onTap: () => _open(context, const InterestRateComparisonScreen()),
            ),
            const SizedBox(height: 10),
            _ToolItem(
              icon: Icons.receipt_long_outlined,
              label: 'Tính thuế TNCN',
              description: 'Ước tính thuế thu nhập cá nhân',
              onTap: () => _open(context, const PersonalIncomeTaxScreen()),
            ),
          ],
        ),
      ),
    );
  }

  void _open(BuildContext context, Widget screen) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => screen),
    );
  }
}

class _ToolItem extends StatelessWidget {
  const _ToolItem({
    required this.icon,
    required this.label,
    required this.description,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final String description;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: ListTile(
          leading: CircleAvatar(
            backgroundColor: colorScheme.primaryContainer,
            child: Icon(icon, color: colorScheme.primary),
          ),
          title: Text(
            label,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
          ),
          subtitle: Text(description),
          trailing: const Icon(Icons.chevron_right),
        ),
      ),
    );
  }
}
