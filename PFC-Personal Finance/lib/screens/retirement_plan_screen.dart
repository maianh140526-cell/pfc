import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../widgets/financial_tool_common.dart';
import '../widgets/pfc_app_bar.dart';
import '../widgets/responsive.dart';

double calculateRetirementFutureValue({
  required double currentSavings,
  required double monthlyContribution,
  required double annualRatePercent,
  required int years,
}) {
  if (years <= 0) return currentSavings;
  final rate = annualRatePercent / 100;
  if (rate == 0) {
    return currentSavings + monthlyContribution * 12 * years;
  }
  final factor = math.pow(1 + rate, years).toDouble();
  return currentSavings * factor +
      monthlyContribution * 12 * ((factor - 1) / rate);
}

double calculateRequiredReturnRate({
  required double targetAmount,
  required double currentSavings,
  required double monthlyContribution,
  required int years,
}) {
  if (years <= 0 || targetAmount <= 0) return 0;

  double futureValue(double annualRatePercent) =>
      calculateRetirementFutureValue(
        currentSavings: currentSavings,
        monthlyContribution: monthlyContribution,
        annualRatePercent: annualRatePercent,
        years: years,
      );

  if (futureValue(0) >= targetAmount) return 0;
  if (futureValue(50) < targetAmount) return double.infinity;

  var low = 0.0;
  var high = 50.0;
  for (var i = 0; i < 80; i++) {
    final middle = (low + high) / 2;
    if (futureValue(middle) >= targetAmount) {
      high = middle;
    } else {
      low = middle;
    }
  }
  return high;
}

double calculateRequiredMonthlyContribution({
  required double targetAmount,
  required double currentSavings,
  required double annualRatePercent,
  required int years,
}) {
  if (years <= 0 || targetAmount <= currentSavings) return 0;

  bool reachesTarget(double contribution) =>
      calculateRetirementFutureValue(
        currentSavings: currentSavings,
        monthlyContribution: contribution,
        annualRatePercent: annualRatePercent,
        years: years,
      ) >=
      targetAmount;

  var low = 0.0;
  var high = targetAmount / 12;
  for (var i = 0; i < 80; i++) {
    final middle = (low + high) / 2;
    if (reachesTarget(middle)) {
      high = middle;
    } else {
      low = middle;
    }
  }
  return high;
}

double calculateRealRetirementTarget({
  required double totalMonthlyBudget,
  required double inflationRatePercent,
  required int years,
}) {
  final baseAmount = totalMonthlyBudget * 12 * 25;
  return baseAmount *
      math.pow(1 + inflationRatePercent / 100, years).toDouble();
}

class RetirementPlanResult {
  const RetirementPlanResult({
    required this.currentAge,
    required this.retireAge,
    required this.totalMonthlyBudget,
    required this.inflationRate,
    required this.baseRetirementAmount,
    required this.realTargetAmount,
    required this.totalIncome,
    required this.fixedExpense,
    required this.currentSavings,
    required this.monthlyContribution,
    required this.requiredReturnRate,
  });

  final int currentAge;
  final int retireAge;
  final double totalMonthlyBudget;
  final double inflationRate;
  final double baseRetirementAmount;
  final double realTargetAmount;
  final double totalIncome;
  final double fixedExpense;
  final double currentSavings;
  final double monthlyContribution;
  final double requiredReturnRate;

  int get years => retireAge - currentAge;
  double get availableSurplus => totalIncome - fixedExpense;
  double get suggestedMinContribution =>
      math.max(0, availableSurplus * 0.60).toDouble();
  double get suggestedMaxContribution =>
      math.max(0, availableSurplus * 0.70).toDouble();
  bool get isSafe => requiredReturnRate <= 15;
  bool get isHighRisk => requiredReturnRate > 15 && requiredReturnRate <= 20;

  int get deferredRetireAge => retireAge + 5;
  double get deferredTarget => calculateRealRetirementTarget(
        totalMonthlyBudget: totalMonthlyBudget,
        inflationRatePercent: inflationRate,
        years: years + 5,
      );
  double get deferredRequiredReturn => calculateRequiredReturnRate(
        targetAmount: deferredTarget,
        currentSavings: currentSavings,
        monthlyContribution: monthlyContribution,
        years: years + 5,
      );
  double get contributionForFifteenPercent =>
      calculateRequiredMonthlyContribution(
        targetAmount: realTargetAmount,
        currentSavings: currentSavings,
        annualRatePercent: 15,
        years: years,
      );
  double get budgetForFifteenPercent {
    final achievableAmount = calculateRetirementFutureValue(
      currentSavings: currentSavings,
      monthlyContribution: monthlyContribution,
      annualRatePercent: 15,
      years: years,
    );
    final inflationFactor = math.pow(1 + inflationRate / 100, years).toDouble();
    return achievableAmount / inflationFactor / 12 / 25;
  }
}

class RetirementPlanScreen extends StatefulWidget {
  const RetirementPlanScreen({super.key});

  @override
  State<RetirementPlanScreen> createState() => _RetirementPlanScreenState();
}

class _RetirementPlanScreenState extends State<RetirementPlanScreen> {
  final _formKey = GlobalKey<FormState>();
  final _currentAgeController = TextEditingController();
  final _retireAgeController = TextEditingController();
  final _basicExpenseController = TextEditingController();
  final _medicalExpenseController = TextEditingController(text: '10000000');
  final _leisureExpenseController = TextEditingController();
  final _inflationRateController = TextEditingController(text: '4');
  final _incomeController = TextEditingController();
  final _fixedExpenseController = TextEditingController();
  final _currentSavingsController = TextEditingController(text: '0');
  final _customContributionController = TextEditingController();

  int? _contributionPercent = 60;
  String? _calculationError;
  RetirementPlanResult? _result;

  @override
  void dispose() {
    _currentAgeController.dispose();
    _retireAgeController.dispose();
    _basicExpenseController.dispose();
    _medicalExpenseController.dispose();
    _leisureExpenseController.dispose();
    _inflationRateController.dispose();
    _incomeController.dispose();
    _fixedExpenseController.dispose();
    _currentSavingsController.dispose();
    _customContributionController.dispose();
    super.dispose();
  }

  void _calculate() {
    setState(() => _calculationError = null);
    if (!_formKey.currentState!.validate()) return;

    final currentAge = int.parse(_currentAgeController.text.trim());
    final retireAge = int.parse(_retireAgeController.text.trim());
    final basicExpense = parseMoneyAmount(_basicExpenseController.text)!;
    final medicalExpense = parseMoneyAmount(_medicalExpenseController.text)!;
    final leisureExpense = parseMoneyAmount(_leisureExpenseController.text)!;
    final inflationRate = parseFinancialNumber(_inflationRateController.text)!;
    final income = parseMoneyAmount(_incomeController.text)!;
    final fixedExpense = parseMoneyAmount(_fixedExpenseController.text)!;
    final currentSavings = parseMoneyAmount(_currentSavingsController.text)!;
    final availableSurplus = income - fixedExpense;

    if (_contributionPercent != null && availableSurplus <= 0) {
      setState(() {
        _calculationError =
            'Thu nhập hiện tại chưa tạo ra phần dư để áp dụng mức góp gợi ý. '
            'Hãy cân đối chi phí hoặc chọn “Tự nhập”.';
      });
      return;
    }

    final monthlyContribution = _contributionPercent == null
        ? parseMoneyAmount(_customContributionController.text)!
        : availableSurplus * _contributionPercent! / 100;
    final years = retireAge - currentAge;
    final monthlyBudget = basicExpense + medicalExpense + leisureExpense;
    final baseAmount = monthlyBudget * 12 * 25;
    final realTarget = calculateRealRetirementTarget(
      totalMonthlyBudget: monthlyBudget,
      inflationRatePercent: inflationRate,
      years: years,
    );

    FocusScope.of(context).unfocus();
    setState(() {
      _result = RetirementPlanResult(
        currentAge: currentAge,
        retireAge: retireAge,
        totalMonthlyBudget: monthlyBudget,
        inflationRate: inflationRate,
        baseRetirementAmount: baseAmount,
        realTargetAmount: realTarget,
        totalIncome: income,
        fixedExpense: fixedExpense,
        currentSavings: currentSavings,
        monthlyContribution: monthlyContribution,
        requiredReturnRate: calculateRequiredReturnRate(
          targetAmount: realTarget,
          currentSavings: currentSavings,
          monthlyContribution: monthlyContribution,
          years: years,
        ),
      );
    });
  }

  String? _validateAge(String? value, String label) {
    final age = int.tryParse(value?.trim() ?? '');
    if (age == null) return 'Vui lòng nhập $label.';
    if (age < 1 || age > 120) return '$label phải từ 1 đến 120.';
    if (label == 'tuổi nghỉ hưu') {
      final currentAge = int.tryParse(_currentAgeController.text.trim());
      if (currentAge != null && age <= currentAge) {
        return 'Tuổi nghỉ hưu phải lớn hơn tuổi hiện tại.';
      }
    }
    return null;
  }

  String? _validateMoney(
    String? value,
    String label, {
    bool allowZero = false,
  }) {
    final amount = parseMoneyAmount(value ?? '');
    if (amount == null) return 'Vui lòng nhập $label.';
    if (allowZero ? amount < 0 : amount <= 0) {
      return allowZero ? '$label không được âm.' : '$label phải lớn hơn 0.';
    }
    return null;
  }

  Widget _moneyField({
    required TextEditingController controller,
    required String label,
    bool allowZero = false,
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      textInputAction: TextInputAction.next,
      decoration: InputDecoration(labelText: label, suffixText: 'đ'),
      validator: (value) =>
          _validateMoney(value, label.toLowerCase(), allowZero: allowZero),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const PfcAppBar(title: Text('Kế hoạch nghỉ hưu')),
      body: ResponsiveBody(
        maxWidth: 820,
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _SectionCard(
                number: 1,
                title: 'Mục tiêu nghỉ hưu',
                subtitle: 'Ước tính ngân sách và giá trị cần tích lũy',
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: _currentAgeController,
                          keyboardType: TextInputType.number,
                          textInputAction: TextInputAction.next,
                          decoration:
                              const InputDecoration(labelText: 'Tuổi hiện tại'),
                          validator: (value) =>
                              _validateAge(value, 'tuổi hiện tại'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextFormField(
                          controller: _retireAgeController,
                          keyboardType: TextInputType.number,
                          textInputAction: TextInputAction.next,
                          decoration: const InputDecoration(
                              labelText: 'Tuổi muốn nghỉ hưu'),
                          validator: (value) =>
                              _validateAge(value, 'tuổi nghỉ hưu'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _moneyField(
                    controller: _basicExpenseController,
                    label: 'Chi tiêu sinh hoạt cơ bản/tháng',
                  ),
                  const SizedBox(height: 12),
                  _moneyField(
                    controller: _medicalExpenseController,
                    label: 'Chi phí y tế dự phòng/tháng',
                    allowZero: true,
                  ),
                  const SizedBox(height: 12),
                  _moneyField(
                    controller: _leisureExpenseController,
                    label: 'Chi tiêu hưởng thụ, giải trí/tháng',
                    allowZero: true,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _inflationRateController,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    textInputAction: TextInputAction.next,
                    decoration: const InputDecoration(
                      labelText: 'Lạm phát bình quân dự phóng',
                      suffixText: '%/năm',
                    ),
                    validator: (value) {
                      final rate = parseFinancialNumber(value ?? '');
                      if (rate == null) return 'Vui lòng nhập tỷ lệ lạm phát.';
                      if (rate < 0 || rate > 30) {
                        return 'Tỷ lệ lạm phát phải từ 0% đến 30%.';
                      }
                      return null;
                    },
                  ),
                ],
              ),
              const SizedBox(height: 14),
              _SectionCard(
                number: 2,
                title: 'Khả năng đóng góp',
                subtitle: 'Chọn mức góp và tính lợi suất cần thiết',
                children: [
                  _moneyField(
                    controller: _incomeController,
                    label: 'Tổng thu nhập/tháng hiện tại',
                  ),
                  const SizedBox(height: 12),
                  _moneyField(
                    controller: _fixedExpenseController,
                    label: 'Chi phí cố định/tháng hiện tại',
                    allowZero: true,
                  ),
                  const SizedBox(height: 12),
                  _moneyField(
                    controller: _currentSavingsController,
                    label: 'Số tiền đã có cho quỹ hưu trí',
                    allowZero: true,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Mức góp từ phần dư hàng tháng',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final percent in const [60, 65, 70])
                        ChoiceChip(
                          label: Text('$percent%'),
                          selected: _contributionPercent == percent,
                          onSelected: (_) => setState(() {
                            _contributionPercent = percent;
                            _calculationError = null;
                          }),
                        ),
                      ChoiceChip(
                        label: const Text('Tự nhập'),
                        selected: _contributionPercent == null,
                        onSelected: (_) => setState(() {
                          _contributionPercent = null;
                          _calculationError = null;
                        }),
                      ),
                    ],
                  ),
                  if (_contributionPercent == null) ...[
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _customContributionController,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      textInputAction: TextInputAction.done,
                      decoration: const InputDecoration(
                        labelText: 'Số tiền muốn góp mỗi tháng',
                        suffixText: 'đ',
                      ),
                      validator: (value) => _contributionPercent == null
                          ? _validateMoney(value, 'số tiền góp mỗi tháng')
                          : null,
                    ),
                  ],
                ],
              ),
              if (_calculationError != null) ...[
                const SizedBox(height: 12),
                _NoticeCard(
                  message: _calculationError!,
                  icon: Icons.warning_amber_rounded,
                  color: Colors.orange.shade800,
                ),
              ],
              const SizedBox(height: 18),
              FilledButton.icon(
                onPressed: _calculate,
                icon: const Icon(Icons.calculate_outlined),
                label: const Text('Phân tích kế hoạch'),
              ),
              if (_result case final result?) ...[
                const SizedBox(height: 22),
                _RetirementResults(result: result),
              ],
              const SizedBox(height: 20),
              Text(
                'Đây là công cụ mô phỏng dựa trên giả định lạm phát và lợi '
                'suất đầu tư, không phải cam kết hay tư vấn đầu tư cá nhân hóa.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RetirementResults extends StatelessWidget {
  const _RetirementResults({required this.result});

  final RetirementPlanResult result;

  String _rateLabel(double rate) {
    if (!rate.isFinite) return '> 50%/năm';
    return '${NumberFormat('0.##', 'vi_VN').format(rate)}%/năm';
  }

  @override
  Widget build(BuildContext context) {
    final statusColor = result.isSafe
        ? Colors.green.shade700
        : result.isHighRisk
            ? Colors.orange.shade800
            : Colors.red.shade700;
    final status = result.isSafe
        ? 'An toàn'
        : result.isHighRisk
            ? 'Rủi ro cao'
            : 'Không khả thi';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Kết quả mục tiêu',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w800,
                )),
        const SizedBox(height: 10),
        FinancialResultCard(
          label: 'Tổng ngân sách mỗi tháng khi nghỉ hưu',
          value: formatVnd(result.totalMonthlyBudget),
          icon: Icons.account_balance_wallet_outlined,
        ),
        FinancialResultCard(
          label: 'Mục tiêu tích lũy gốc (quy tắc 25 lần)',
          value: formatVnd(result.baseRetirementAmount),
          icon: Icons.flag_outlined,
        ),
        Card(
          color: Theme.of(context).colorScheme.primaryContainer,
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              children: [
                const Icon(Icons.track_changes, size: 34),
                const SizedBox(height: 8),
                const Text('Mục tiêu thực tế đã điều chỉnh lạm phát'),
                const SizedBox(height: 6),
                Text(
                  formatVnd(result.realTargetAmount),
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                ),
                Text('Sau ${result.years} năm'),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Khả năng đóng góp',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                        )),
                const SizedBox(height: 10),
                Text('Phần dư hiện tại: ${formatVnd(result.availableSurplus)}'),
                Text(
                  'Mức góp gợi ý 60–70%: '
                  '${formatVnd(result.suggestedMinContribution)} – '
                  '${formatVnd(result.suggestedMaxContribution)}/tháng',
                ),
                Text(
                  'Mức góp đã chọn: ${formatVnd(result.monthlyContribution)}/tháng',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                if (result.monthlyContribution > result.availableSurplus)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      'Mức góp đang cao hơn phần dư hàng tháng. Hãy kiểm tra '
                      'khả năng duy trì trước khi áp dụng.',
                      style: TextStyle(color: Colors.orange.shade800),
                    ),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 10),
        Card(
          color: statusColor.withValues(alpha: 0.10),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.insights, color: statusColor),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        '$status · ${_rateLabel(result.requiredReturnRate)}',
                        style:
                            Theme.of(context).textTheme.titleMedium?.copyWith(
                                  color: statusColor,
                                  fontWeight: FontWeight.w800,
                                ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                if (result.isSafe)
                  const Text(
                    'Mức lợi suất yêu cầu nằm trong ngưỡng kế hoạch. Có thể '
                    'tham khảo danh mục đa dạng gồm Cổ phiếu, Chứng chỉ quỹ, '
                    'Vàng và Bất động sản.',
                  )
                else if (result.isHighRisk)
                  const Text(
                    'Lợi suất yêu cầu cao và khó duy trì dài hạn. Bạn nên tăng '
                    'mức góp, kéo dài thời gian hoặc điều chỉnh ngân sách.',
                  )
                else
                  const Text(
                    'Lợi suất yêu cầu vượt ngưỡng hợp lý. Hãy cân nhắc một '
                    'trong ba phương án điều chỉnh bên dưới.',
                  ),
              ],
            ),
          ),
        ),
        if (!result.isSafe && !result.isHighRisk) ...[
          const SizedBox(height: 12),
          _AdjustmentCard(
            title: 'Option A · Lùi tuổi nghỉ hưu',
            icon: Icons.more_time,
            message: 'Lùi đến ${result.deferredRetireAge} tuổi, lợi suất yêu '
                'cầu mới khoảng ${_rateLabel(result.deferredRequiredReturn)}.',
          ),
          _AdjustmentCard(
            title: 'Option B · Tăng mức góp',
            icon: Icons.savings_outlined,
            message: 'Để đưa lợi suất yêu cầu về 15%/năm, cần góp khoảng '
                '${formatVnd(result.contributionForFifteenPercent)}/tháng.',
          ),
          _AdjustmentCard(
            title: 'Option C · Giảm ngân sách nghỉ hưu',
            icon: Icons.tune,
            message: 'Với mức góp hiện tại và lợi suất 15%/năm, ngân sách '
                'nghỉ hưu tối đa phù hợp khoảng '
                '${formatVnd(result.budgetForFifteenPercent)}/tháng.',
          ),
        ],
      ],
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.number,
    required this.title,
    required this.subtitle,
    required this.children,
  });

  final int number;
  final String title;
  final String subtitle;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                CircleAvatar(
                  child: Text('$number'),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title,
                          style:
                              Theme.of(context).textTheme.titleMedium?.copyWith(
                                    fontWeight: FontWeight.w800,
                                  )),
                      Text(subtitle,
                          style: Theme.of(context).textTheme.bodySmall),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            ...children,
          ],
        ),
      ),
    );
  }
}

class _AdjustmentCard extends StatelessWidget {
  const _AdjustmentCard({
    required this.title,
    required this.icon,
    required this.message,
  });

  final String title;
  final IconData icon;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: Icon(icon, color: Theme.of(context).colorScheme.primary),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Text(message),
        ),
      ),
    );
  }
}

class _NoticeCard extends StatelessWidget {
  const _NoticeCard({
    required this.message,
    required this.icon,
    required this.color,
  });

  final String message;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: color.withValues(alpha: 0.10),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color),
            const SizedBox(width: 10),
            Expanded(child: Text(message)),
          ],
        ),
      ),
    );
  }
}
