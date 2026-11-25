import 'package:firebase_auth/firebase_auth.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/transaction_model.dart';
import '../models/user_model.dart';
import '../services/analytics_service.dart';
import '../services/auth_service.dart';
import '../theme/pfc_brand.dart';
import '../utils/greeting_helper.dart';
import '../widgets/pfc_app_bar.dart';
import '../widgets/responsive.dart';
import 'add_transaction_screen.dart';
import 'financial_tools_screen.dart';
import 'saving_challenge_screen.dart';
import 'saving_goal_screen.dart';
import 'transaction_history_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({
    super.key,
    required this.onSeeAllTransactions,
    this.title = 'Tổng quan',
    this.showHomeSections = true,
  });

  final VoidCallback onSeeAllTransactions;
  final String title;
  final bool showHomeSections;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final _analytics = AnalyticsService();
  final _authService = AuthService();
  final _money = NumberFormat.decimalPattern('vi_VN');
  late final Future<UserModel?> _userFuture;
  DashboardPeriod _period = DashboardPeriod.month;

  static const _pieColors = [
    Color(0xFF5C6BC0),
    Color(0xFF26A69A),
    Color(0xFFEF5350),
    Color(0xFFFFA726),
    Color(0xFFAB47BC),
    Color(0xFF42A5F5),
    Color(0xFF66BB6A),
    Color(0xFF8D6E63),
  ];

  @override
  void initState() {
    super.initState();
    _userFuture = _authService.getCurrentUser();
  }

  @override
  Widget build(BuildContext context) {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) {
      return const Scaffold(
        body: Center(child: Text('Bạn chưa đăng nhập.')),
      );
    }

    return Scaffold(
      appBar:
          widget.showHomeSections ? null : PfcAppBar(title: Text(widget.title)),
      body: ResponsiveBody(
        child: StreamBuilder<DashboardAnalytics>(
          stream: _analytics.watchDashboard(userId: uid, period: _period),
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting &&
                !snapshot.hasData) {
              return const LoadingView();
            }
            if (snapshot.hasError) {
              return ErrorView(
                  message: 'Không tải được dữ liệu.\n${snapshot.error}');
            }
            final data = snapshot.data ??
                const DashboardAnalytics(
                  totalIncome: 0,
                  totalExpense: 0,
                  expenseByCategory: [],
                  series: [],
                  recentTransactions: [],
                );

            return LayoutBuilder(
              builder: (context, constraints) {
                final compact = constraints.maxWidth < AppBreakpoints.compact;
                final reportPieChart = SizedBox(
                  height: 220,
                  child: data.expenseByCategory.isEmpty
                      ? const Center(
                          child: Text('Chưa có chi tiêu trong kỳ này.'))
                      : PieChart(_pieData(data)),
                );
                final lineChart = SizedBox(
                  height: 220,
                  child: data.series.every(
                          (item) => item.income == 0 && item.expense == 0)
                      ? const Center(child: Text('Chưa có dữ liệu biểu đồ.'))
                      : LineChart(_lineData(data.series)),
                );

                return ListView(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 112),
                  children: [
                    if (widget.showHomeSections) ...[
                      const Align(
                        alignment: Alignment.centerLeft,
                        child: PfcBrandMark(),
                      ),
                      const SizedBox(height: 18),
                      FutureBuilder<UserModel?>(
                        future: _userFuture,
                        builder: (context, userSnapshot) {
                          final firestoreName = userSnapshot.data?.name.trim();
                          final fallbackName = FirebaseAuth
                                  .instance.currentUser?.displayName
                                  ?.trim() ??
                              '';
                          final name = firestoreName?.isNotEmpty == true
                              ? firestoreName!
                              : fallbackName.isNotEmpty
                                  ? fallbackName
                                  : 'Người dùng';

                          return Card(
                            color:
                                Theme.of(context).colorScheme.primaryContainer,
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 14,
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    getGreeting(),
                                    style: Theme.of(context)
                                        .textTheme
                                        .bodySmall
                                        ?.copyWith(
                                          color: Theme.of(context)
                                              .colorScheme
                                              .primary,
                                        ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    name,
                                    style: Theme.of(context)
                                        .textTheme
                                        .headlineSmall
                                        ?.copyWith(
                                          color: Theme.of(context)
                                              .colorScheme
                                              .primary,
                                          fontWeight: FontWeight.w700,
                                        ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                      const SizedBox(height: 20),
                      _BalanceCard(
                        balance: '${_money.format(data.balance)} đ',
                        income: '+${_money.format(data.totalIncome)} đ',
                        expense: '-${_money.format(data.totalExpense)} đ',
                      ),
                      const SizedBox(height: 18),
                      _periodSelector(),
                    ] else ...[
                      _periodSelector(),
                      const SizedBox(height: 16),
                      if (compact)
                        Column(
                          children: [
                            _SummaryCard(
                              title: 'Tổng thu',
                              value: '+${_money.format(data.totalIncome)} đ',
                              color: PfcBrand.income,
                            ),
                            const SizedBox(height: 8),
                            _SummaryCard(
                              title: 'Tổng chi',
                              value: '-${_money.format(data.totalExpense)} đ',
                              color: PfcBrand.expense,
                            ),
                            const SizedBox(height: 8),
                            _SummaryCard(
                              title: 'Số dư',
                              value: '${_money.format(data.balance)} đ',
                              color: Theme.of(context).colorScheme.primary,
                            ),
                          ],
                        )
                      else
                        Row(
                          children: [
                            Expanded(
                              child: _SummaryCard(
                                title: 'Tổng thu',
                                value: '+${_money.format(data.totalIncome)} đ',
                                color: PfcBrand.income,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: _SummaryCard(
                                title: 'Tổng chi',
                                value: '-${_money.format(data.totalExpense)} đ',
                                color: PfcBrand.expense,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: _SummaryCard(
                                title: 'Số dư',
                                value: '${_money.format(data.balance)} đ',
                                color: Theme.of(context).colorScheme.primary,
                              ),
                            ),
                          ],
                        ),
                    ],
                    SizedBox(height: widget.showHomeSections ? 26 : 20),
                    if (widget.showHomeSections)
                      _homeExpenseChart(data)
                    else
                      _chartBlock('Chi theo danh mục', reportPieChart, data),
                    if (!widget.showHomeSections) ...[
                      const SizedBox(height: 24),
                      Text(
                        _period == DashboardPeriod.year
                            ? 'Thu / chi 12 tháng'
                            : 'Thu / chi 7 ngày',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 8),
                      lineChart,
                      const SizedBox(height: 24),
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              'Giao dịch gần nhất',
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                          ),
                          TextButton(
                            onPressed: widget.onSeeAllTransactions,
                            child: const Text('Xem tất cả'),
                          ),
                        ],
                      ),
                      if (data.recentTransactions.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 16),
                          child: Text('Chưa có giao dịch.'),
                        )
                      else
                        ...data.recentTransactions.map(_recentTile),
                    ],
                    if (widget.showHomeSections) ...[
                      const SizedBox(height: 24),
                      _quickActions(compact),
                    ],
                  ],
                );
              },
            );
          },
        ),
      ),
    );
  }

  Widget _periodSelector() {
    return SegmentedButton<DashboardPeriod>(
      expandedInsets: EdgeInsets.zero,
      segments: const [
        ButtonSegment(
          value: DashboardPeriod.week,
          label: Text('Tuần này'),
        ),
        ButtonSegment(
          value: DashboardPeriod.month,
          label: Text('Tháng này'),
        ),
        ButtonSegment(
          value: DashboardPeriod.year,
          label: Text('Năm nay'),
        ),
      ],
      selected: {_period},
      onSelectionChanged: (value) {
        setState(() => _period = value.first);
      },
    );
  }

  void _openScreen(Widget screen) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => screen),
    );
  }

  Widget _quickActions(bool compact) {
    final actions = [
      _QuickActionButton(
        icon: Icons.flag,
        label: 'Mục tiêu',
        onTap: () => _openScreen(const SavingGoalScreen()),
      ),
      _QuickActionButton(
        icon: Icons.emoji_events,
        label: 'Tiết kiệm',
        onTap: () => _openScreen(const SavingChallengeScreen()),
      ),
      _QuickActionButton(
        icon: Icons.history,
        label: 'Lịch sử',
        onTap: () => _openScreen(const TransactionHistoryScreen()),
      ),
      _QuickActionButton(
        icon: Icons.calculate,
        label: 'Công cụ',
        onTap: () => _openScreen(const FinancialToolsScreen()),
      ),
    ];

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var index = 0; index < actions.length; index++) ...[
          if (index > 0) SizedBox(width: compact ? 6 : 10),
          Expanded(
            child: SizedBox(
              height: compact ? 76 : 88,
              child: actions[index],
            ),
          ),
        ],
      ],
    );
  }

  Widget _homeExpenseChart(DashboardAnalytics data) {
    if (data.expenseByCategory.isEmpty) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Chi tiêu theo danh mục',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 28),
          const Center(child: Text('Chưa có chi tiêu trong kỳ này.')),
        ],
      );
    }

    final total = data.totalExpense <= 0 ? 1 : data.totalExpense;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Chi tiêu theo danh mục',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
        ),
        const SizedBox(height: 16),
        Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                SizedBox(
                  width: 145,
                  height: 145,
                  child: PieChart(
                    _pieData(
                      data,
                      showTitles: false,
                      centerSpaceRadius: 35,
                      sectionRadius: 45,
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (var i = 0; i < data.expenseByCategory.length; i++)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 4),
                          child: Row(
                            children: [
                              Container(
                                width: 9,
                                height: 9,
                                decoration: BoxDecoration(
                                  color: _pieColors[i % _pieColors.length],
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 7),
                              SizedBox(
                                width: 38,
                                child: Text(
                                  '${(data.expenseByCategory[i].amount / total * 100).round()}%',
                                  style: const TextStyle(
                                    color: PfcBrand.primary,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                              Expanded(
                                child: Text(
                                  data.expenseByCategory[i].category,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _chartBlock(
    String title,
    Widget chart,
    DashboardAnalytics data, {
    bool showLegend = true,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        chart,
        if (showLegend && data.expenseByCategory.isNotEmpty) ...[
          const SizedBox(height: 8),
          Wrap(
            spacing: 12,
            runSpacing: 4,
            children: [
              for (var i = 0; i < data.expenseByCategory.length; i++)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 10,
                      height: 10,
                      color: _pieColors[i % _pieColors.length],
                    ),
                    const SizedBox(width: 4),
                    Text(data.expenseByCategory[i].category),
                  ],
                ),
            ],
          ),
        ],
      ],
    );
  }

  PieChartData _pieData(
    DashboardAnalytics data, {
    bool showTitles = true,
    double centerSpaceRadius = 36,
    double sectionRadius = 56,
  }) {
    final total = data.totalExpense <= 0 ? 1 : data.totalExpense;
    return PieChartData(
      sectionsSpace: 2,
      centerSpaceRadius: centerSpaceRadius,
      sections: [
        for (var i = 0; i < data.expenseByCategory.length; i++)
          PieChartSectionData(
            value: data.expenseByCategory[i].amount,
            title: showTitles
                ? '${(data.expenseByCategory[i].amount / total * 100).round()}%'
                : '',
            color: _pieColors[i % _pieColors.length],
            radius: sectionRadius,
            titleStyle: const TextStyle(fontSize: 11, color: Colors.white),
          ),
      ],
    );
  }

  LineChartData _lineData(List<DateAmount> series) {
    final maxValue = series.fold<double>(0, (max, item) {
      final local = item.income > item.expense ? item.income : item.expense;
      return local > max ? local : max;
    });
    return LineChartData(
      minX: 0,
      maxX: (series.length - 1).toDouble(),
      minY: 0,
      maxY: maxValue <= 0 ? 1 : maxValue * 1.2,
      gridData: const FlGridData(show: true),
      borderData: FlBorderData(show: false),
      titlesData: FlTitlesData(
        topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        rightTitles:
            const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        leftTitles: const AxisTitles(
          sideTitles: SideTitles(showTitles: false),
        ),
        bottomTitles: AxisTitles(
          sideTitles: SideTitles(
            showTitles: true,
            interval: 1,
            getTitlesWidget: (value, meta) {
              final index = value.round();
              if (index < 0 || index >= series.length) {
                return const SizedBox.shrink();
              }
              return Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(series[index].label,
                    style: const TextStyle(fontSize: 10)),
              );
            },
          ),
        ),
      ),
      lineBarsData: [
        LineChartBarData(
          spots: [
            for (var i = 0; i < series.length; i++)
              FlSpot(i.toDouble(), series[i].income),
          ],
          isCurved: true,
          color: PfcBrand.income,
          barWidth: 3,
          dotData: const FlDotData(show: false),
        ),
        LineChartBarData(
          spots: [
            for (var i = 0; i < series.length; i++)
              FlSpot(i.toDouble(), series[i].expense),
          ],
          isCurved: true,
          color: PfcBrand.expense,
          barWidth: 3,
          dotData: const FlDotData(show: false),
        ),
      ],
    );
  }

  Widget _recentTile(TransactionModel item) {
    final color = item.isIncome ? PfcBrand.income : PfcBrand.expense;
    final prefix = item.isIncome ? '+' : '-';
    return ListTile(
      contentPadding: EdgeInsets.zero,
      title: Text(item.category),
      subtitle: Text(DateFormat('dd/MM/yyyy').format(item.date)),
      trailing: Text(
        '$prefix${_money.format(item.amount)} đ',
        style: TextStyle(color: color, fontWeight: FontWeight.w600),
      ),
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => AddTransactionScreen(existing: item),
          ),
        );
      },
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({
    required this.title,
    required this.value,
    required this.color,
  });

  final String title;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.labelMedium),
            const SizedBox(height: 8),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(
                value,
                style: TextStyle(
                  color: color,
                  fontWeight: FontWeight.w700,
                  fontSize: 16,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BalanceCard extends StatelessWidget {
  const _BalanceCard({
    required this.balance,
    required this.income,
    required this.expense,
  });

  final String balance;
  final String income;
  final String expense;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Card(
      color: colorScheme.primaryContainer,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Tổng số dư', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 6),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(
                balance,
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      color: colorScheme.primary,
                      fontWeight: FontWeight.w700,
                    ),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Tổng thu\n$income',
                    style: const TextStyle(color: PfcBrand.income),
                  ),
                ),
                Expanded(
                  child: Text(
                    'Tổng chi\n$expense',
                    textAlign: TextAlign.right,
                    style: const TextStyle(color: PfcBrand.expense),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _QuickActionButton extends StatelessWidget {
  const _QuickActionButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Card(
      color: colorScheme.primaryContainer.withValues(alpha: .62),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: colorScheme.primary, size: 22),
              const SizedBox(height: 5),
              Text(
                label,
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: colorScheme.primary,
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
