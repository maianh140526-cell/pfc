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

class AddTransactionScreen extends StatefulWidget {
  const AddTransactionScreen({super.key, this.existing});

  final TransactionModel? existing;

  @override
  State<AddTransactionScreen> createState() => _AddTransactionScreenState();
}

class _AddTransactionScreenState extends State<AddTransactionScreen> {
  final _formKey = GlobalKey<FormState>();
  final _amountController = TextEditingController();
  final _noteController = TextEditingController();
  final _transactionService = TransactionService();
  final _categoryService = CategoryService();
  final _budgetService = BudgetService();
  final _money = NumberFormat.decimalPattern('vi_VN');

  String _type = 'expense';
  String? _category;
  DateTime _date = DateTime.now();
  bool _isSaving = false;
  String? _errorMessage;

  bool get _isEditing => widget.existing != null;

  @override
  void initState() {
    super.initState();
    final existing = widget.existing;
    if (existing != null) {
      _amountController.text = existing.amount.toStringAsFixed(0);
      _noteController.text = existing.note;
      _type = existing.type;
      _category = existing.category;
      _date = existing.date;
    }
  }

  @override
  void dispose() {
    _amountController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (picked != null) {
      setState(() => _date = picked);
    }
  }

  Future<void> _warnIfBudgetExceeded({
    required String userId,
    required String type,
    required String categoryName,
    required DateTime date,
  }) async {
    if (type != 'expense' || categoryName.isEmpty) return;

    final month = BudgetModel.monthKey(date);
    final budget = await _budgetService.findBudget(
      userId: userId,
      month: month,
      categoryName: categoryName,
    );
    if (budget == null) return;

    final spent = await _budgetService.calculateSpent(
      userId,
      budget.categoryId,
      month,
    );
    if (spent <= budget.limitAmount || !mounted) return;

    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Vượt ngân sách'),
        content: Text(
          'Danh mục "${budget.categoryName}" tháng $month đã chi '
          '${_money.format(spent)} đ, vượt hạn mức '
          '${_money.format(budget.limitAmount)} đ.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Đã hiểu'),
          ),
        ],
      ),
    );
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;

    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) {
      setState(() => _errorMessage = 'Bạn chưa đăng nhập.');
      return;
    }

    setState(() {
      _isSaving = true;
      _errorMessage = null;
    });

    final amount = double.parse(
      _amountController.text.trim().replaceAll(' ', '').replaceAll(',', '.'),
    );

    final transaction = TransactionModel(
      id: widget.existing?.id ?? '',
      userId: uid,
      type: _type,
      amount: amount,
      category: _category ?? '',
      note: _noteController.text.trim(),
      date: _date,
    );

    try {
      if (_isEditing) {
        await _transactionService.updateTransaction(transaction);
      } else {
        await _transactionService.addTransaction(transaction);
      }
      if (!mounted) return;
      await _warnIfBudgetExceeded(
        userId: uid,
        type: _type,
        categoryName: _category ?? '',
        date: _date,
      );
      if (!mounted) return;
      Navigator.of(context).pop();
    } catch (e) {
      if (!mounted) return;
      setState(() => _errorMessage = 'Không lưu được giao dịch. $e');
    } finally {
      if (mounted) {
        setState(() => _isSaving = false);
      }
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

    return StreamBuilder<List<CategoryModel>>(
      stream: _categoryService.getCategoriesStream(uid),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting &&
            !snapshot.hasData) {
          return Scaffold(
            appBar: PfcAppBar(
              title: Text(_isEditing ? 'Sửa giao dịch' : 'Thêm giao dịch'),
            ),
            body: const LoadingView(),
          );
        }
        if (snapshot.hasError) {
          return Scaffold(
            appBar: PfcAppBar(
              title: Text(_isEditing ? 'Sửa giao dịch' : 'Thêm giao dịch'),
            ),
            body: ErrorView(
              message: 'Không tải được danh mục.\n${snapshot.error}',
            ),
          );
        }

        final categories = uniqueCategoriesForType(snapshot.data ?? [], _type);
        final categoriesById = {
          for (final category in categories) category.id: category,
        };
        String? selectedCategoryId;
        for (final category in categories) {
          if (category.name == _category) {
            selectedCategoryId = category.id;
            break;
          }
        }

        return Scaffold(
          appBar: PfcAppBar(
            title: Text(_isEditing ? 'Sửa giao dịch' : 'Thêm giao dịch'),
          ),
          body: SafeArea(
            child: ResponsiveBody(
              maxWidth: 560,
              child: Form(
                key: _formKey,
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    SegmentedButton<String>(
                      segments: const [
                        ButtonSegment(value: 'expense', label: Text('Chi')),
                        ButtonSegment(value: 'income', label: Text('Thu')),
                      ],
                      selected: {_type},
                      onSelectionChanged: (value) {
                        setState(() {
                          _type = value.first;
                          _category = null;
                        });
                      },
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _amountController,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      inputFormatters: [
                        FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
                      ],
                      decoration: const InputDecoration(
                        labelText: 'Số tiền',
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
                          return 'Nhập số tiền hợp lệ.';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),
                    DropdownButtonFormField<String>(
                      key: ValueKey(_type),
                      initialValue: selectedCategoryId,
                      decoration: const InputDecoration(labelText: 'Danh mục'),
                      items: categories
                          .map(
                            (item) => DropdownMenuItem(
                              value: item.id,
                              child: Row(
                                children: [
                                  Icon(iconFromName(item.icon)),
                                  const SizedBox(width: 8),
                                  Text(item.name),
                                ],
                              ),
                            ),
                          )
                          .toList(),
                      onChanged: categories.isEmpty
                          ? null
                          : (categoryId) {
                              final selected = categoriesById[categoryId];
                              setState(() => _category = selected?.name);
                            },
                      validator: (value) {
                        if (categories.isEmpty) {
                          return 'Chưa có danh mục. Hãy đăng xuất rồi đăng nhập lại.';
                        }
                        if (value == null || value.isEmpty) {
                          return 'Chọn danh mục.';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _noteController,
                      decoration: const InputDecoration(labelText: 'Ghi chú'),
                      maxLines: 2,
                    ),
                    const SizedBox(height: 16),
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Ngày'),
                      subtitle: Text(DateFormat('dd/MM/yyyy').format(_date)),
                      trailing: const Icon(Icons.calendar_today),
                      onTap: _pickDate,
                    ),
                    if (_errorMessage != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        _errorMessage!,
                        style: TextStyle(
                            color: Theme.of(context).colorScheme.error),
                      ),
                    ],
                    const SizedBox(height: 24),
                    FilledButton(
                      onPressed: _isSaving ? null : _save,
                      child: _isSaving
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Text(_isEditing ? 'Lưu' : 'Thêm'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
