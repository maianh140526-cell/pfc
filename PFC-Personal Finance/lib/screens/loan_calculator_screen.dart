import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../widgets/financial_tool_common.dart';
import '../widgets/responsive.dart';
import '../widgets/pfc_app_bar.dart';

class LoanCalculatorScreen extends StatefulWidget {
  const LoanCalculatorScreen({super.key});

  @override
  State<LoanCalculatorScreen> createState() => _LoanCalculatorScreenState();
}

class _LoanPayment {
  const _LoanPayment({
    required this.month,
    required this.principal,
    required this.interest,
    required this.balance,
  });

  final int month;
  final double principal;
  final double interest;
  final double balance;
}

class _LoanCalculatorScreenState extends State<LoanCalculatorScreen> {
  final _formKey = GlobalKey<FormState>();
  final _principalController = TextEditingController();
  final _rateController = TextEditingController();
  final _monthsController = TextEditingController();

  double? _monthlyPayment;
  double? _totalInterest;
  double? _totalPayment;
  List<_LoanPayment> _schedule = const [];

  @override
  void dispose() {
    _principalController.dispose();
    _rateController.dispose();
    _monthsController.dispose();
    super.dispose();
  }

  void _calculate() {
    if (!_formKey.currentState!.validate()) return;

    final principal = parseMoneyAmount(_principalController.text)!;
    final annualRate = parseFinancialNumber(_rateController.text)!;
    final months = int.parse(_monthsController.text.trim());
    final monthlyRate = annualRate / 100 / 12;
    final payment = monthlyRate == 0
        ? principal / months
        : principal *
            (monthlyRate * math.pow(1 + monthlyRate, months)) /
            (math.pow(1 + monthlyRate, months) - 1);

    var balance = principal;
    final schedule = <_LoanPayment>[];
    var interestTotal = 0.0;
    for (var month = 1; month <= months; month++) {
      final interest = balance * monthlyRate;
      var principalPaid = payment - interest;
      if (month == months || principalPaid > balance) {
        principalPaid = balance;
      }
      balance = math.max(0, balance - principalPaid).toDouble();
      interestTotal += interest;
      schedule.add(
        _LoanPayment(
          month: month,
          principal: principalPaid,
          interest: interest,
          balance: balance,
        ),
      );
    }

    setState(() {
      _monthlyPayment = payment;
      _totalInterest = interestTotal;
      _totalPayment = principal + interestTotal;
      _schedule = schedule;
    });
  }

  String? _positiveNumber(
    String? value,
    String label, {
    bool allowZero = false,
    bool isMoney = false,
  }) {
    final number = isMoney
        ? parseMoneyAmount(value ?? '')
        : parseFinancialNumber(value ?? '');
    if (number == null) return 'Vui lòng nhập $label.';
    if (allowZero ? number < 0 : number <= 0) {
      return allowZero ? '$label không được âm.' : '$label phải lớn hơn 0.';
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const PfcAppBar(title: Text('Tính khoản vay trả góp')),
      body: ResponsiveBody(
        maxWidth: 920,
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              TextFormField(
                controller: _principalController,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                  labelText: 'Số tiền vay',
                  suffixText: 'đ',
                ),
                validator: (value) =>
                    _positiveNumber(value, 'số tiền vay', isMoney: true),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _rateController,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                  labelText: 'Lãi suất mỗi năm',
                  suffixText: '%',
                ),
                validator: (value) =>
                    _positiveNumber(value, 'lãi suất', allowZero: true),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _monthsController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Thời hạn vay',
                  suffixText: 'tháng',
                ),
                validator: (value) {
                  final months = int.tryParse(value?.trim() ?? '');
                  if (months == null || months <= 0) {
                    return 'Số tháng phải là số nguyên lớn hơn 0.';
                  }
                  if (months > 600) return 'Thời hạn tối đa là 600 tháng.';
                  return null;
                },
              ),
              const SizedBox(height: 20),
              FilledButton.icon(
                onPressed: _calculate,
                icon: const Icon(Icons.calculate_outlined),
                label: const Text('Tính khoản vay'),
              ),
              if (_monthlyPayment != null) ...[
                const SizedBox(height: 20),
                FinancialResultCard(
                  label: 'Phải trả mỗi tháng',
                  value: formatVnd(_monthlyPayment!),
                  icon: Icons.calendar_month_outlined,
                ),
                FinancialResultCard(
                  label: 'Tổng tiền lãi',
                  value: formatVnd(_totalInterest!),
                  icon: Icons.percent,
                  color: Colors.orange.shade800,
                ),
                FinancialResultCard(
                  label: 'Tổng tiền gốc và lãi',
                  value: formatVnd(_totalPayment!),
                  icon: Icons.account_balance_outlined,
                ),
                const SizedBox(height: 20),
                Text(
                  'Lịch trả nợ chi tiết',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 8),
                Card(
                  clipBehavior: Clip.antiAlias,
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: DataTable(
                      columns: const [
                        DataColumn(label: Text('Tháng')),
                        DataColumn(label: Text('Tiền gốc'), numeric: true),
                        DataColumn(label: Text('Tiền lãi'), numeric: true),
                        DataColumn(label: Text('Dư nợ'), numeric: true),
                      ],
                      rows: [
                        for (final item in _schedule)
                          DataRow(
                            cells: [
                              DataCell(Text('${item.month}')),
                              DataCell(Text(formatVnd(item.principal))),
                              DataCell(Text(formatVnd(item.interest))),
                              DataCell(Text(formatVnd(item.balance))),
                            ],
                          ),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
