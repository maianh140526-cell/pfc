import '../models/transaction_model.dart';
import 'transaction_service.dart';

enum DashboardPeriod { week, month, year }

class CategoryAmount {
  const CategoryAmount({required this.category, required this.amount});

  final String category;
  final double amount;
}

class DateAmount {
  const DateAmount({
    required this.date,
    required this.label,
    required this.income,
    required this.expense,
  });

  final DateTime date;
  final String label;
  final double income;
  final double expense;
}

class DashboardAnalytics {
  const DashboardAnalytics({
    required this.totalIncome,
    required this.totalExpense,
    required this.expenseByCategory,
    required this.series,
    required this.recentTransactions,
  });

  final double totalIncome;
  final double totalExpense;
  final List<CategoryAmount> expenseByCategory;
  final List<DateAmount> series;
  final List<TransactionModel> recentTransactions;

  double get balance => totalIncome - totalExpense;
}

class AnalyticsRange {
  const AnalyticsRange({required this.start, required this.end});

  final DateTime start;
  final DateTime end;
}

class AnalyticsService {
  AnalyticsService({TransactionService? transactionService})
      : _transactionService = transactionService ?? TransactionService();

  final TransactionService _transactionService;

  static const weekLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

  Stream<DashboardAnalytics> watchDashboard({
    required String userId,
    required DashboardPeriod period,
    DateTime? now,
  }) {
    return _transactionService.getTransactionsStream(userId).map((items) {
      return buildAnalytics(items, period, now: now);
    });
  }

  DashboardAnalytics buildAnalytics(
    List<TransactionModel> transactions,
    DashboardPeriod period, {
    DateTime? now,
  }) {
    final range = rangeOf(period, now: now);
    final inPeriod = filterByRange(transactions, range);
    return DashboardAnalytics(
      totalIncome: totalIncome(inPeriod),
      totalExpense: totalExpense(inPeriod),
      expenseByCategory: groupExpenseByCategory(inPeriod),
      series: groupIncomeExpenseByDate(transactions, period, now: now),
      recentTransactions: transactions.take(5).toList(),
    );
  }

  AnalyticsRange rangeOf(DashboardPeriod period, {DateTime? now}) {
    final current = now ?? DateTime.now();
    switch (period) {
      case DashboardPeriod.week:
        final start = DateTime(current.year, current.month, current.day)
            .subtract(Duration(days: current.weekday - 1));
        final end = start
            .add(const Duration(days: 7))
            .subtract(const Duration(milliseconds: 1));
        return AnalyticsRange(start: start, end: end);
      case DashboardPeriod.month:
        final start = DateTime(current.year, current.month, 1);
        final end = DateTime(current.year, current.month + 1, 1)
            .subtract(const Duration(milliseconds: 1));
        return AnalyticsRange(start: start, end: end);
      case DashboardPeriod.year:
        final start = DateTime(current.year, 1, 1);
        final end = DateTime(current.year + 1, 1, 1)
            .subtract(const Duration(milliseconds: 1));
        return AnalyticsRange(start: start, end: end);
    }
  }

  List<TransactionModel> filterByRange(
    List<TransactionModel> transactions,
    AnalyticsRange range,
  ) {
    return transactions.where((item) {
      return !item.date.isBefore(range.start) && !item.date.isAfter(range.end);
    }).toList();
  }

  double totalIncome(List<TransactionModel> transactions) {
    return transactions
        .where((item) => item.isIncome)
        .fold<double>(0, (sum, item) => sum + item.amount);
  }

  double totalExpense(List<TransactionModel> transactions) {
    return transactions
        .where((item) => !item.isIncome)
        .fold<double>(0, (sum, item) => sum + item.amount);
  }

  List<CategoryAmount> groupExpenseByCategory(
      List<TransactionModel> transactions) {
    final totals = <String, double>{};
    for (final item in transactions.where((item) => !item.isIncome)) {
      final key = item.category.isEmpty ? 'Khác' : item.category;
      totals[key] = (totals[key] ?? 0) + item.amount;
    }
    final list = totals.entries
        .map(
            (entry) => CategoryAmount(category: entry.key, amount: entry.value))
        .toList()
      ..sort((a, b) => b.amount.compareTo(a.amount));
    return list;
  }

  List<DateAmount> groupIncomeExpenseByDate(
    List<TransactionModel> transactions,
    DashboardPeriod period, {
    DateTime? now,
  }) {
    final current = now ?? DateTime.now();
    if (period == DashboardPeriod.year) {
      return List.generate(12, (index) {
        final month = index + 1;
        final start = DateTime(current.year, month, 1);
        final end = DateTime(current.year, month + 1, 1)
            .subtract(const Duration(milliseconds: 1));
        final inMonth = filterByRange(
          transactions,
          AnalyticsRange(start: start, end: end),
        );
        return DateAmount(
          date: start,
          label: month.toString().padLeft(2, '0'),
          income: totalIncome(inMonth),
          expense: totalExpense(inMonth),
        );
      });
    }

    if (period == DashboardPeriod.week) {
      final range = rangeOf(DashboardPeriod.week, now: current);
      return List.generate(7, (index) {
        final day = range.start.add(Duration(days: index));
        return _totalsForDay(transactions, day, weekLabels[index]);
      });
    }

    final today = DateTime(current.year, current.month, current.day);
    return List.generate(7, (index) {
      final day = today.subtract(Duration(days: 6 - index));
      return _totalsForDay(transactions, day, '${day.day}');
    });
  }

  DateAmount _totalsForDay(
    List<TransactionModel> transactions,
    DateTime day,
    String label,
  ) {
    final start = DateTime(day.year, day.month, day.day);
    final end = start
        .add(const Duration(days: 1))
        .subtract(const Duration(milliseconds: 1));
    final inDay =
        filterByRange(transactions, AnalyticsRange(start: start, end: end));
    return DateAmount(
      date: start,
      label: label,
      income: totalIncome(inDay),
      expense: totalExpense(inDay),
    );
  }
}
