import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import '../models/saving_challenge_model.dart';
import '../services/saving_challenge_service.dart';
import '../widgets/financial_tool_common.dart';
import '../widgets/responsive.dart';
import '../widgets/pfc_app_bar.dart';

class SavingChallengeScreen extends StatefulWidget {
  const SavingChallengeScreen({super.key});

  @override
  State<SavingChallengeScreen> createState() => _SavingChallengeScreenState();
}

class _SavingChallengeScreenState extends State<SavingChallengeScreen> {
  final _service = SavingChallengeService();
  final _money = NumberFormat.decimalPattern('vi_VN');
  final Set<String> _checkingIds = {};

  Future<void> _deleteChallenge(SavingChallenge challenge) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Xóa thử thách?'),
        content: Text(
          "Bạn có chắc muốn xóa thử thách '${challenge.title}'? "
          'Toàn bộ tiến độ check-in đã lưu sẽ bị mất và không thể khôi phục.',
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

    if (confirmed == true) {
      await _service.deleteChallenge(challenge.id);
    }
  }

  Future<void> _addChallenge() async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return;

    final titleController = TextEditingController();
    final targetAmountController = TextEditingController();
    final daysController = TextEditingController(text: '7');
    final formKey = GlobalKey<FormState>();
    var challengeType = 'saving';

    final created = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Thêm thử thách'),
          content: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: titleController,
                  decoration: const InputDecoration(labelText: 'Tên thử thách'),
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) {
                      return 'Nhập tên thử thách.';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 12),
                Align(
                  alignment: Alignment.centerLeft,
                  child: Wrap(
                    spacing: 8,
                    children: [
                      ChoiceChip(
                        label: const Text('Tiết kiệm'),
                        selected: challengeType == 'saving',
                        onSelected: (_) {
                          setDialogState(() => challengeType = 'saving');
                        },
                      ),
                      ChoiceChip(
                        label: const Text('Chi tiêu ít hơn'),
                        selected: challengeType == 'spending_limit',
                        onSelected: (_) {
                          setDialogState(
                            () => challengeType = 'spending_limit',
                          );
                        },
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: targetAmountController,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
                  ],
                  decoration: InputDecoration(
                    labelText: challengeType == 'saving'
                        ? 'Số tiền cần đạt được'
                        : 'Hạn mức chi tiêu tối đa',
                    suffixText: 'đ',
                  ),
                  validator: (value) {
                    final amount = parseMoneyAmount(value ?? '');
                    if (amount == null || amount <= 0) {
                      return 'Nhập số tiền thử thách hợp lệ.';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: daysController,
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  decoration: const InputDecoration(labelText: 'Số ngày'),
                  validator: (value) {
                    final parsed = int.tryParse(value ?? '');
                    if (parsed == null || parsed <= 0) {
                      return 'Nhập số ngày hợp lệ.';
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
              child: const Text('Tạo'),
            ),
          ],
        ),
      ),
    );

    if (created != true) {
      titleController.dispose();
      targetAmountController.dispose();
      daysController.dispose();
      return;
    }

    final title = titleController.text.trim();
    final targetAmount = parseMoneyAmount(targetAmountController.text)!;
    final days = int.parse(daysController.text.trim());
    titleController.dispose();
    targetAmountController.dispose();
    daysController.dispose();

    await _service.addChallenge(
      SavingChallenge(
        id: '',
        userId: uid,
        title: title,
        challengeType: challengeType,
        targetAmount: targetAmount,
        durationDays: days,
        startDate: DateTime.now(),
        firstCheckInDate: null,
        lastCheckInDate: null,
        checkedDays: 0,
        progressAmount: 0,
        status: 'active',
      ),
    );
  }

  Future<void> _checkIn(SavingChallenge challenge) async {
    if (_checkingIds.contains(challenge.id)) return;
    setState(() => _checkingIds.add(challenge.id));
    try {
      await _service.checkInToday(challenge.id);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Không thể check-in. $error')),
      );
    } finally {
      if (mounted) {
        setState(() => _checkingIds.remove(challenge.id));
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

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: const PfcAppBar(
          title: Text('Thử thách tiết kiệm'),
          bottom: TabBar(
            tabs: [
              Tab(text: 'Đang thực hiện'),
              Tab(text: 'Đã hoàn thành'),
            ],
          ),
        ),
        floatingActionButton: FloatingActionButton(
          heroTag: 'fab-challenges',
          onPressed: _addChallenge,
          child: const Icon(Icons.add),
        ),
        body: StreamBuilder<List<SavingChallenge>>(
          stream: _service.getChallengesStream(uid),
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting &&
                !snapshot.hasData) {
              return const LoadingView();
            }
            if (snapshot.hasError) {
              return ErrorView(
                message: 'Không tải được thử thách.\n${snapshot.error}',
              );
            }

            final challenges = snapshot.data ?? [];
            final active = challenges
                .where((challenge) => challenge.status == 'active')
                .toList();
            final finished =
                challenges.where((challenge) => challenge.isFinished).toList();

            return TabBarView(
              children: [
                _buildChallengeList(
                  active,
                  emptyMessage: challenges.isEmpty
                      ? 'Chưa có thử thách. Bấm + để thêm.'
                      : 'Không có thử thách đang thực hiện.',
                ),
                _buildChallengeList(
                  finished,
                  emptyMessage: 'Chưa có thử thách đã hoàn thành.',
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildChallengeList(
    List<SavingChallenge> challenges, {
    required String emptyMessage,
  }) {
    if (challenges.isEmpty) return Center(child: Text(emptyMessage));

    return ResponsiveBody(
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 88),
        itemCount: challenges.length,
        separatorBuilder: (context, index) => const SizedBox(height: 8),
        itemBuilder: (context, index) => _buildChallengeCard(challenges[index]),
      ),
    );
  }

  Widget _buildChallengeCard(SavingChallenge challenge) {
    final isChecking = _checkingIds.contains(challenge.id);
    final canCheckIn = challenge.status == 'active' &&
        !challenge.checkedInToday &&
        !isChecking;
    final progressRatio = challenge.targetAmount <= 0
        ? 0.0
        : (challenge.progressAmount / challenge.targetAmount)
            .clamp(0, 1)
            .toDouble();
    final progressColor = challenge.isSpendingLimit
        ? challenge.progressAmount > challenge.targetAmount
            ? Colors.red.shade700
            : progressRatio >= 0.8
                ? Colors.orange.shade700
                : Theme.of(context).colorScheme.primary
        : challenge.progressAmount >= challenge.targetAmount
            ? Colors.green.shade700
            : Theme.of(context).colorScheme.primary;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(
                        challenge.title,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color:
                              Theme.of(context).colorScheme.secondaryContainer,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          challenge.isSpendingLimit
                              ? 'Chi tiêu ít hơn'
                              : 'Tiết kiệm',
                          style: Theme.of(context).textTheme.labelSmall,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  tooltip: 'Xóa thử thách',
                  visualDensity: VisualDensity.compact,
                  color: Theme.of(context)
                      .colorScheme
                      .onSurfaceVariant
                      .withValues(alpha: 0.65),
                  onPressed: () => _deleteChallenge(challenge),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text('${challenge.checkedDays}/${challenge.durationDays} ngày'),
            const SizedBox(height: 8),
            Text(
              challenge.isSpendingLimit
                  ? 'Đã chi: ${_money.format(challenge.progressAmount)} đ / Hạn mức: ${_money.format(challenge.targetAmount)} đ'
                  : 'Số dư hiện tại: ${_money.format(challenge.progressAmount)} đ / Mục tiêu: ${_money.format(challenge.targetAmount)} đ',
              style: TextStyle(
                color: progressColor,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            LinearProgressIndicator(
              value: progressRatio,
              minHeight: 8,
              color: progressColor,
            ),
            const SizedBox(height: 12),
            if (challenge.isSuccess)
              _StatusLabel(
                color: Colors.green.shade700,
                icon: Icons.check_circle,
                label: 'Thành công',
              )
            else if (challenge.isFailed)
              _StatusLabel(
                color: Colors.red.shade700,
                icon: Icons.cancel,
                label: 'Thất bại',
              )
            else
              Align(
                alignment: Alignment.centerRight,
                child: FilledButton(
                  onPressed: canCheckIn ? () => _checkIn(challenge) : null,
                  child: isChecking
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(
                          challenge.checkedInToday
                              ? 'Đã check-in hôm nay'
                              : 'Check-in hôm nay',
                        ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _StatusLabel extends StatelessWidget {
  const _StatusLabel({
    required this.color,
    required this.icon,
    required this.label,
  });

  final Color color;
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerRight,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(color: color, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}
