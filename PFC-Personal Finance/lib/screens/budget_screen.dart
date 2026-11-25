import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import '../models/budget_model.dart';
import '../models/category_model.dart';
import '../models/transaction_model.dart';
import '../services/budget_service.dart';
import '../services/category_service.dart';
import '../services/transaction_service.dart';
import '../widgets/category_icon.dart';
import '../widgets/responsive.dart';
import '../widgets/pfc_app_bar.dart';

class BudgetScreen extends StatefulWidget {
  const BudgetScreen({super.key});

  @override
  State<BudgetScreen> createState() => _BudgetScreenState();
}

class _BudgetScreenState extends State<BudgetScreen> {
  final _budgetService = BudgetService();
  final _categoryService = CategoryService();
  final _transactionService = TransactionService();
  final _money = NumberFormat.decimalPattern('vi_VN');

  late final String _month;

  @override
  void initState() {
    super.initState();
    _month = BudgetModel.monthKey(DateTime.now());
  }

  Color _barColor(double ratio) {
    if (ratio > 1) return Colors.red.shade700;
    if (ratio >= 0.8) return Colors.orange.shade700;
    return Colors.green.shade700;
  }

  Future<void> _addBudget(
    List<CategoryModel> expenseCategories,
    List<BudgetModel> budgets,
  ) async {
    final usedIds = budgets.map((item) => item.categoryId).toSet();
    final available =
        expenseCategories.where((item) => !usedIds.contains(item.id)).toList();
    if (available.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Mọi danh mục chi tiêu đã có ngân sách tháng này.'),
        ),
      );
      return;
    }

    var selectedId = available.first.id;
    final amountController = TextEditingController();
    final formKey = GlobalKey<FormState>();

    final created = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Thêm ngân sách'),
          content: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  initialValue: selectedId,
                  decoration: const InputDecoration(labelText: 'Danh mục'),
                  items: available
                      .map(
                        (item) => DropdownMenuItem(
                          value: item.id,
                          child: Text(item.name),
                        ),
                      )
                      .toList(),
                  onChanged: (value) {
                    if (value != null) selectedId = value;
                  },
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: amountController,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
                  ],
                  decoration: const InputDecoration(
                    labelText: 'Hạn mức',
                    suffixText: 'đ',
                  ),
                  validator: (value) {
                    final parsed = double.tryParse(
                      (value ?? '')
                          .trim()
                          .replaceAll(' ', '')
                          .replaceAll(',', '.'),
                    );
                    if (parsed == null || parsed <= 0) {
                      return 'Nhập hạn mức hợp lệ.';
                    }
                    return null;
                  },
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Hủy'),
            ),
            FilledButton(
              onPressed: () {
                if (formKey.currentState?.validate() ?? false) {
                  Navigator.pop(context, true);
                }
              },
              child: const Text('Lưu'),
            ),
          ],
        );
      },
    );

    if (created != true) {
      amountController.dispose();
      return;
    }

    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return;

    final limit = double.parse(
      amountController.text.trim().replaceAll(' ', '').replaceAll(',', '.'),
    );
    amountController.dispose();

    final selected = available.firstWhere((item) => item.id == selectedId);

    try {
      await _budgetService.addBudget(
        BudgetModel(
          id: '',
          userId: uid,
          categoryId: selected.id,
          categoryName: selected.name,
          limitAmount: limit,
          month: _month,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) {
      return const Scaffold(
        body: Center(child: Text('Bạn chưa đăng nhập.')),
      );
    }

    final monthLabel = DateFormat('MM/yyyy').format(DateTime.now());

    return Scaffold(
      appBar: PfcAppBar(title: Text('Ngân sách $monthLabel')),
      floatingActionButton: StreamBuilder<List<CategoryModel>>(
        stream: _categoryService.getCategoriesStream(uid),
        builder: (context, categorySnapshot) {
          return StreamBuilder<List<BudgetModel>>(
            stream: _budgetService.getBudgetsStream(uid, _month),
            builder: (context, budgetSnapshot) {
              final expenses = (categorySnapshot.data ?? [])
                  .where((item) => item.type == 'expense')
                  .toList();
              final budgets = budgetSnapshot.data ?? [];
              return FloatingActionButton(
                heroTag: 'fab-budget',
                onPressed: () => _addBudget(expenses, budgets),
                child: const Icon(Icons.add),
              );
            },
          );
        },
      ),
      body: StreamBuilder<List<CategoryModel>>(
        stream: _categoryService.getCategoriesStream(uid),
        builder: (context, categorySnapshot) {
          final categories = {
            for (final item in categorySnapshot.data ?? <CategoryModel>[])
              item.id: item,
          };

          return StreamBuilder<List<TransactionModel>>(
            stream: _transactionService.getTransactionsStream(uid),
            builder: (context, transactionSnapshot) {
              final transactions = transactionSnapshot.data ?? [];

              return StreamBuilder<List<BudgetModel>>(
                stream: _budgetService.getBudgetsStream(uid, _month),
                builder: (context, budgetSnapshot) {
                  if (budgetSnapshot.connectionState ==
                          ConnectionState.waiting &&
                      !budgetSnapshot.hasData) {
                    return const LoadingView();
                  }
                  if (budgetSnapshot.hasError) {
                    return ErrorView(
                      message:
                          'Không tải được ngân sách.\n${budgetSnapshot.error}',
                    );
                  }

                  final budgets = budgetSnapshot.data ?? [];
                  if (budgets.isEmpty) {
                    return const Center(
                      child:
                          Text('Chưa có ngân sách tháng này. Bấm + để thêm.'),
                    );
                  }

                  return ResponsiveBody(
                    child: ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 88),
                      itemCount: budgets.length,
                      separatorBuilder: (context, index) =>
                          const SizedBox(height: 8),
                      itemBuilder: (context, index) {
                        final budget = budgets[index];
                        final category = categories[budget.categoryId];
                        final spent = _budgetService.spentFromTransactions(
                          transactions: transactions,
                          userId: uid,
                          categoryId: budget.categoryId,
                          categoryName: budget.categoryName,
                          month: _month,
                        );
                        final ratio = budget.limitAmount <= 0
                            ? 0.0
                            : spent / budget.limitAmount;
                        final color = _barColor(ratio);

                        return Dismissible(
                          key: ValueKey(budget.id),
                          direction: DismissDirection.endToStart,
                          background: Container(
                            color: Colors.red,
                            alignment: Alignment.centerRight,
                            padding: const EdgeInsets.only(right: 16),
                            child:
                                const Icon(Icons.delete, color: Colors.white),
                          ),
                          confirmDismiss: (_) {
                            return showDialog<bool>(
                              context: context,
                              builder: (context) => AlertDialog(
                                title: const Text('Xóa ngân sách?'),
                                actions: [
                                  TextButton(
                                    onPressed: () =>
                                        Navigator.pop(context, false),
                                    child: const Text('Hủy'),
                                  ),
                                  TextButton(
                                    onPressed: () =>
                                        Navigator.pop(context, true),
                                    child: const Text('Xóa'),
                                  ),
                                ],
                              ),
                            );
                          },
                          onDismissed: (_) =>
                              _budgetService.deleteBudget(budget.id),
                          child: Card(
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Icon(iconFromName(
                                          category?.icon ?? 'category')),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Text(
                                          budget.categoryName,
                                          style: Theme.of(context)
                                              .textTheme
                                              .titleMedium,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    '${_money.format(spent)} / ${_money.format(budget.limitAmount)} đ',
                                  ),
                                  const SizedBox(height: 8),
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(4),
                                    child: LinearProgressIndicator(
                                      value: ratio.clamp(0, 1),
                                      minHeight: 8,
                                      color: color,
                                      backgroundColor:
                                          color.withValues(alpha: 0.2),
                                    ),
                                  ),
                                  if (ratio > 1) ...[
                                    const SizedBox(height: 8),
                                    Text(
                                      'Đã vượt ngân sách',
                                      style:
                                          TextStyle(color: Colors.red.shade700),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  );
                },
              );
            },
          );
        },
      ),
    );
  }
}
