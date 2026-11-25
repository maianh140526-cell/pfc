import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/category_model.dart';
import '../models/transaction_model.dart';
import '../services/category_service.dart';
import '../services/transaction_service.dart';
import '../widgets/category_icon.dart';
import '../widgets/responsive.dart';
import '../widgets/pfc_app_bar.dart';
import 'add_transaction_screen.dart';

class TransactionHistoryScreen extends StatefulWidget {
  const TransactionHistoryScreen({super.key, this.embedded = false});

  final bool embedded;

  @override
  State<TransactionHistoryScreen> createState() =>
      _TransactionHistoryScreenState();
}

class _TransactionHistoryScreenState extends State<TransactionHistoryScreen> {
  final _transactionService = TransactionService();
  final _categoryService = CategoryService();
  final _moneyFormat = NumberFormat.decimalPattern('vi_VN');

  String _typeFilter = 'all';
  late DateTime _month;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _month = DateTime(now.year, now.month);
  }

  Future<void> _pickMonth() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _month,
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
      helpText: 'Chọn tháng',
    );
    if (picked != null) {
      setState(() => _month = DateTime(picked.year, picked.month));
    }
  }

  List<TransactionModel> _applyFilters(List<TransactionModel> items) {
    return items.where((item) {
      final sameMonth =
          item.date.year == _month.year && item.date.month == _month.month;
      final sameType = _typeFilter == 'all' || item.type == _typeFilter;
      return sameMonth && sameType;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) {
      const message = Center(child: Text('Bạn chưa đăng nhập.'));
      return widget.embedded
          ? message
          : const Scaffold(
              appBar: PfcAppBar(
                title: Text('Lịch sử giao dịch'),
              ),
              body: message,
            );
    }

    final content = Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: _typeFilter,
                  decoration: const InputDecoration(
                    labelText: 'Loại',
                    isDense: true,
                  ),
                  items: const [
                    DropdownMenuItem(value: 'all', child: Text('Tất cả')),
                    DropdownMenuItem(value: 'income', child: Text('Thu')),
                    DropdownMenuItem(value: 'expense', child: Text('Chi')),
                  ],
                  onChanged: (value) {
                    if (value != null) {
                      setState(() => _typeFilter = value);
                    }
                  },
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton(
                  onPressed: _pickMonth,
                  child: Text(DateFormat('MM/yyyy').format(_month)),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: StreamBuilder<List<CategoryModel>>(
            stream: _categoryService.getCategoriesStream(uid),
            builder: (context, categorySnapshot) {
              final categories = {
                for (final item in categorySnapshot.data ?? <CategoryModel>[])
                  item.name: item,
              };

              return StreamBuilder<List<TransactionModel>>(
                stream: _transactionService.getTransactionsStream(uid),
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting &&
                      !snapshot.hasData) {
                    return const LoadingView();
                  }
                  if (snapshot.hasError) {
                    return ErrorView(
                      message: 'Không tải được giao dịch.\n${snapshot.error}',
                    );
                  }

                  final items = _applyFilters(snapshot.data ?? []);
                  if (items.isEmpty) {
                    return const Center(child: Text('Chưa có giao dịch.'));
                  }

                  return ListView.separated(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    itemCount: items.length,
                    separatorBuilder: (context, index) =>
                        const Divider(height: 1),
                    itemBuilder: (context, index) {
                      final item = items[index];
                      final category = categories[item.category];
                      final amountText =
                          '${item.isIncome ? '+' : '-'}${_moneyFormat.format(item.amount)} đ';
                      final color = item.isIncome
                          ? Colors.green.shade700
                          : Colors.red.shade700;

                      return Dismissible(
                        key: ValueKey(item.id),
                        direction: DismissDirection.endToStart,
                        background: Container(
                          color: Colors.red,
                          alignment: Alignment.centerRight,
                          padding: const EdgeInsets.only(right: 16),
                          child: const Icon(Icons.delete, color: Colors.white),
                        ),
                        confirmDismiss: (_) async {
                          return showDialog<bool>(
                            context: context,
                            builder: (context) => AlertDialog(
                              title: const Text('Xóa giao dịch?'),
                              content: const Text(
                                  'Hành động này không hoàn tác được.'),
                              actions: [
                                TextButton(
                                  onPressed: () =>
                                      Navigator.pop(context, false),
                                  child: const Text('Hủy'),
                                ),
                                TextButton(
                                  onPressed: () => Navigator.pop(context, true),
                                  child: const Text('Xóa'),
                                ),
                              ],
                            ),
                          );
                        },
                        onDismissed: (_) {
                          _transactionService.deleteTransaction(item.id);
                        },
                        child: ListTile(
                          leading: CircleAvatar(
                            child: Icon(
                                iconFromName(category?.icon ?? 'category')),
                          ),
                          title: Text(item.category),
                          subtitle: Text(
                            [
                              DateFormat('dd/MM/yyyy').format(item.date),
                              if (item.note.isNotEmpty) item.note,
                            ].join(' · '),
                          ),
                          trailing: Text(
                            amountText,
                            style: TextStyle(
                              color: color,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          onTap: () {
                            Navigator.of(context).push(
                              MaterialPageRoute<void>(
                                builder: (_) =>
                                    AddTransactionScreen(existing: item),
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
        ),
      ],
    );

    if (widget.embedded) return content;

    return Scaffold(
      appBar: const PfcAppBar(title: Text('Lịch sử giao dịch')),
      body: ResponsiveBody(child: content),
      floatingActionButton: FloatingActionButton(
        heroTag: 'fab-transaction-history',
        tooltip: 'Thêm giao dịch',
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
