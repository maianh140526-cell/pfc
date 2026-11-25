import 'dart:math' as math;

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../widgets/financial_tool_common.dart';
import '../widgets/responsive.dart';
import '../widgets/pfc_app_bar.dart';

class CompoundInterestScreen extends StatefulWidget {
  const CompoundInterestScreen({super.key});

  @override
  State<CompoundInterestScreen> createState() => _CompoundInterestScreenState();
}

class _CompoundInterestScreenState extends State<CompoundInterestScreen> {
  final _formKey = GlobalKey<FormState>();
  final _principalController = TextEditingController();
  final _rateController = TextEditingController();
  final _yearsController = TextEditingController();
  final _monthlyController = TextEditingController();

  double? _futureValue;
  double? _interestEarned;
  List<FlSpot> _spots = const [];

  @override
  void dispose() {
    _principalController.dispose();
    _rateController.dispose();
    _yearsController.dispose();
    _monthlyController.dispose();
    super.dispose();
  }

  double _valueAtYear({
    required double principal,
    required double annualRate,
    required int year,
    required double monthlyContribution,
  }) {
    final months = year * 12;
    final monthlyRate = annualRate / 100 / 12;
    if (monthlyRate == 0) {
      return principal + monthlyContribution * months;
    }
    final factor = math.pow(1 + monthlyRate, months).toDouble();
    final principalValue = principal * factor;
    final annuityValue = monthlyContribution * (factor - 1) / monthlyRate;
    return principalValue + annuityValue;
  }

  void _calculate() {
    if (!_formKey.currentState!.validate()) return;

    final principal = parseMoneyAmount(_principalController.text)!;
    final rate = parseFinancialNumber(_rateController.text)!;
    final years = int.parse(_yearsController.text.trim());
    final monthly = parseMoneyAmount(_monthlyController.text) ?? 0;
    final future = _valueAtYear(
      principal: principal,
      annualRate: rate,
      year: years,
      monthlyContribution: monthly,
    );
    final totalContributed = principal + monthly * years * 12;

    setState(() {
      _futureValue = future;
      _interestEarned = future - totalContributed;
      _spots = [
        for (var year = 0; year <= years; year++)
          FlSpot(
            year.toDouble(),
            _valueAtYear(
              principal: principal,
              annualRate: rate,
              year: year,
              monthlyContribution: monthly,
            ),
          ),
      ];
    });
  }

  String? _positiveValidator(String? value, String label) {
    final number = parseMoneyAmount(value ?? '');
    if (number == null) return 'Vui lòng nhập $label.';
    if (number <= 0) return '$label phải lớn hơn 0.';
    return null;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const PfcAppBar(title: Text('Tính lãi kép')),
      body: ResponsiveBody(
        maxWidth: 760,
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
                  labelText: 'Số tiền gốc',
                  suffixText: 'đ',
                ),
                validator: (value) => _positiveValidator(value, 'số tiền gốc'),
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
                validator: (value) {
                  final rate = parseFinancialNumber(value ?? '');
                  if (rate == null) return 'Vui lòng nhập lãi suất.';
                  if (rate < 0) return 'Lãi suất không được âm.';
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _yearsController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Số năm',
                  suffixText: 'năm',
                ),
                validator: (value) {
                  final years = int.tryParse(value?.trim() ?? '');
                  if (years == null || years <= 0) {
                    return 'Số năm phải là số nguyên lớn hơn 0.';
                  }
                  if (years > 100) return 'Số năm tối đa là 100.';
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _monthlyController,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                  labelText: 'Góp thêm hàng tháng (tùy chọn)',
                  suffixText: 'đ',
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) return null;
                  final amount = parseMoneyAmount(value);
                  if (amount == null || amount < 0) {
                    return 'Số tiền góp thêm không hợp lệ.';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 20),
              FilledButton.icon(
                onPressed: _calculate,
                icon: const Icon(Icons.calculate_outlined),
                label: const Text('Tính kết quả'),
              ),
              if (_futureValue != null) ...[
                const SizedBox(height: 20),
                FinancialResultCard(
                  label: 'Số tiền cuối cùng',
                  value: formatVnd(_futureValue!),
                  icon: Icons.savings_outlined,
                ),
                FinancialResultCard(
                  label: 'Tổng tiền lãi nhận được',
                  value: formatVnd(_interestEarned!),
                  icon: Icons.trending_up,
                  color: Colors.green.shade700,
                ),
                const SizedBox(height: 20),
                Text(
                  'Tăng trưởng theo từng năm',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 12),
                SizedBox(
                  height: 260,
                  child: LineChart(
                    LineChartData(
                      minX: 0,
                      maxX: _spots.last.x,
                      minY: 0,
                      gridData: const FlGridData(show: true),
                      borderData: FlBorderData(show: false),
                      titlesData: const FlTitlesData(
                        topTitles: AxisTitles(
                          sideTitles: SideTitles(showTitles: false),
                        ),
                        rightTitles: AxisTitles(
                          sideTitles: SideTitles(showTitles: false),
                        ),
                        leftTitles: AxisTitles(
                          sideTitles: SideTitles(showTitles: false),
                        ),
                        bottomTitles: AxisTitles(
                          sideTitles: SideTitles(showTitles: true),
                        ),
                      ),
                      lineBarsData: [
                        LineChartBarData(
                          spots: _spots,
                          isCurved: true,
                          color: Theme.of(context).colorScheme.primary,
                          barWidth: 3,
                          dotData: const FlDotData(show: false),
                          belowBarData: BarAreaData(
                            show: true,
                            color: Theme.of(context)
                                .colorScheme
                                .primary
                                .withValues(alpha: 0.12),
                          ),
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
