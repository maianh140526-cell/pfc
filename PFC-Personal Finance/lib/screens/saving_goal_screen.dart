import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import '../models/saving_goal_model.dart';
import '../services/saving_goal_service.dart';
import '../widgets/responsive.dart';
import '../widgets/pfc_app_bar.dart';

class SavingGoalScreen extends StatefulWidget {
  const SavingGoalScreen({super.key});

  @override
  State<SavingGoalScreen> createState() => _SavingGoalScreenState();
}

class _SavingGoalScreenState extends State<SavingGoalScreen> {
  final _service = SavingGoalService();
  final _money = NumberFormat.decimalPattern('vi_VN');

  Future<void> _addGoal() async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return;

    final nameController = TextEditingController();
    final amountController = TextEditingController();
    final formKey = GlobalKey<FormState>();
    var deadline = DateTime.now().add(const Duration(days: 30));

    final created = await showDialog<bool>(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: const Text('Thêm mục tiêu'),
              content: Form(
                key: formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextFormField(
                      controller: nameController,
                      decoration:
                          const InputDecoration(labelText: 'Tên mục tiêu'),
                      validator: (value) {
                        if (value == null || value.trim().isEmpty) {
                          return 'Nhập tên mục tiêu.';
                        }
                        return null;
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
                        labelText: 'Số tiền mục tiêu',
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
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Hạn chót'),
                      subtitle: Text(DateFormat('dd/MM/yyyy').format(deadline)),
                      trailing: const Icon(Icons.calendar_today),
                      onTap: () async {
                        final picked = await showDatePicker(
                          context: context,
                          initialDate: deadline,
                          firstDate: DateTime.now(),
                          lastDate: DateTime(2100),
                        );
                        if (picked != null) {
                          setDialogState(() => deadline = picked);
                        }
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
      },
    );

    if (created != true) {
      nameController.dispose();
      amountController.dispose();
      return;
    }

    final target = double.parse(
      amountController.text.trim().replaceAll(' ', '').replaceAll(',', '.'),
    );
    final name = nameController.text.trim();
    nameController.dispose();
    amountController.dispose();

    await _service.addGoal(
      SavingGoal(
        id: '',
        userId: uid,
        name: name,
        targetAmount: target,
        currentAmount: 0,
        deadline: deadline,
      ),
    );
  }

  Future<void> _addMoney(SavingGoal goal) async {
    final amountController = TextEditingController();
    final formKey = GlobalKey<FormState>();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Nạp tiền'),
        content: Form(
          key: formKey,
          child: TextFormField(
            controller: amountController,
            autofocus: true,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
            ],
            decoration: const InputDecoration(
              labelText: 'Số tiền nạp thêm',
              suffixText: 'đ',
            ),
            validator: (value) {
              final parsed = double.tryParse(
                (value ?? '').trim().replaceAll(' ', '').replaceAll(',', '.'),
              );
              if (parsed == null || parsed <= 0) {
                return 'Nhập số tiền hợp lệ.';
              }
              return null;
            },
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
            child: const Text('Nạp'),
          ),
        ],
      ),
    );

    if (confirmed != true) {
      amountController.dispose();
      return;
    }

    final amount = double.parse(
      amountController.text.trim().replaceAll(' ', '').replaceAll(',', '.'),
    );
    amountController.dispose();

    await _service.updateGoal(
      goal.copyWith(currentAmount: goal.currentAmount + amount),
    );
  }

  String _daysLabel(int days) {
    if (days > 1) return 'Còn $days ngày';
    if (days == 1) return 'Còn 1 ngày';
    if (days == 0) return 'Hết hạn hôm nay';
    return 'Quá hạn ${-days} ngày';
  }

  Future<bool> _confirmDeleteGoal(SavingGoal goal) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Xóa mục tiêu?'),
        content: Text(
          "Bạn có chắc muốn xóa mục tiêu '${goal.name}'? "
          'Hành động này không thể hoàn tác.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Hủy'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Xóa'),
          ),
        ],
      ),
    );
    return confirmed ?? false;
  }

  Future<void> _deleteGoal(SavingGoal goal) async {
    if (!await _confirmDeleteGoal(goal)) return;
    await _service.deleteGoal(goal.id);
  }

  @override
  Widget build(BuildContext context) {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) {
      return const Scaffold(
        body: Center(child: Text('Bạn chưa đăng nhập.')),
      );
    }

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: const PfcAppBar(
          title: Text('Mục tiêu tiết kiệm'),
          bottom: TabBar(
            tabs: [
              Tab(text: 'Đang thực hiện'),
              Tab(text: 'Đã hoàn thành'),
            ],
          ),
        ),
        floatingActionButton: FloatingActionButton(
          heroTag: 'fab-goals',
          onPressed: _addGoal,
          child: const Icon(Icons.add),
        ),
        body: StreamBuilder<List<SavingGoal>>(
          stream: _service.getGoalsStream(uid),
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting &&
                !snapshot.hasData) {
              return const LoadingView();
            }
            if (snapshot.hasError) {
              return ErrorView(
                message: 'Không tải được mục tiêu.\n${snapshot.error}',
              );
            }

            final goals = snapshot.data ?? [];
            final activeGoals = goals
                .where((goal) => goal.currentAmount < goal.targetAmount)
                .toList();
            final completedGoals = goals
                .where((goal) => goal.currentAmount >= goal.targetAmount)
                .toList();

            return TabBarView(
              children: [
                _buildGoalList(
                  activeGoals,
                  emptyMessage: goals.isEmpty
                      ? 'Chưa có mục tiêu. Bấm + để thêm.'
                      : 'Không có mục tiêu đang thực hiện.',
                ),
                _buildGoalList(
                  completedGoals,
                  emptyMessage: 'Chưa có mục tiêu đã hoàn thành.',
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildGoalList(
    List<SavingGoal> goals, {
    required String emptyMessage,
  }) {
    if (goals.isEmpty) {
      return Center(child: Text(emptyMessage));
    }

    return ResponsiveBody(
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 88),
        itemCount: goals.length,
        separatorBuilder: (context, index) => const SizedBox(height: 8),
        itemBuilder: (context, index) => _buildGoalCard(goals[index]),
      ),
    );
  }

  Widget _buildGoalCard(SavingGoal goal) {
    final isCompleted = goal.currentAmount >= goal.targetAmount;
    final completedColor = Colors.green.shade700;
    final progressLabel = '${goal.progressPercent.round()}%';

    return Dismissible(
      key: ValueKey(goal.id),
      direction: DismissDirection.endToStart,
      background: Container(
        color: Colors.red,
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 16),
        child: const Icon(Icons.delete, color: Colors.white),
      ),
      confirmDismiss: (_) => _confirmDeleteGoal(goal),
      onDismissed: (_) => _service.deleteGoal(goal.id),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      goal.name,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                  if (isCompleted)
                    Icon(Icons.check_circle, color: completedColor, size: 20),
                  IconButton(
                    tooltip: 'Xóa mục tiêu',
                    visualDensity: VisualDensity.compact,
                    color: Theme.of(context)
                        .colorScheme
                        .onSurfaceVariant
                        .withValues(alpha: 0.65),
                    onPressed: () => _deleteGoal(goal),
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(_daysLabel(goal.daysLeft)),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      '${_money.format(goal.currentAmount)} / ${_money.format(goal.targetAmount)} đ',
                    ),
                  ),
                  Text(
                    progressLabel,
                    style: TextStyle(
                      color: isCompleted
                          ? completedColor
                          : Theme.of(context).colorScheme.primary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              LinearProgressIndicator(
                value: goal.progress,
                minHeight: 8,
                color: isCompleted ? completedColor : null,
              ),
              const SizedBox(height: 12),
              if (isCompleted)
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    Icon(Icons.check, size: 18, color: completedColor),
                    const SizedBox(width: 6),
                    Text(
                      'Đã hoàn thành mục tiêu',
                      style: TextStyle(
                        color: completedColor,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                )
              else
                Align(
                  alignment: Alignment.centerRight,
                  child: FilledButton(
                    onPressed: () => _addMoney(goal),
                    child: const Text('Nạp tiền'),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
