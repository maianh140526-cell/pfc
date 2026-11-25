import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../widgets/financial_tool_common.dart';
import '../widgets/responsive.dart';
import '../widgets/pfc_app_bar.dart';

class PersonalIncomeTaxScreen extends StatefulWidget {
  const PersonalIncomeTaxScreen({super.key});

  @override
  State<PersonalIncomeTaxScreen> createState() =>
      _PersonalIncomeTaxScreenState();
}

class _TaxDetail {
  const _TaxDetail({
    required this.bracket,
    required this.taxableAmount,
    required this.rate,
    required this.tax,
  });

  final String bracket;
  final double taxableAmount;
  final double rate;
  final double tax;
}

class _PersonalIncomeTaxScreenState extends State<PersonalIncomeTaxScreen> {
  static const _personalDeduction = 15500000.0;
  static const _dependentDeduction = 6200000.0;

  final _formKey = GlobalKey<FormState>();
  final _incomeController = TextEditingController();
  final _dependentsController = TextEditingController(text: '0');
  final _insuranceController = TextEditingController();

  double? _taxableIncome;
  double? _tax;
  double? _netIncome;
  List<_TaxDetail> _details = const [];

  @override
  void dispose() {
    _incomeController.dispose();
    _dependentsController.dispose();
    _insuranceController.dispose();
    super.dispose();
  }

  double _quickTax(double taxableIncome) {
    if (taxableIncome <= 0) return 0;
    if (taxableIncome <= 10000000) return taxableIncome * 0.05;
    if (taxableIncome <= 30000000) return taxableIncome * 0.10 - 500000;
    if (taxableIncome <= 60000000) return taxableIncome * 0.20 - 3500000;
    if (taxableIncome <= 100000000) return taxableIncome * 0.30 - 9500000;
    return taxableIncome * 0.35 - 14500000;
  }

  List<_TaxDetail> _buildDetails(double taxableIncome) {
    if (taxableIncome <= 0) return const [];

    const limits = [0.0, 10000000.0, 30000000.0, 60000000.0, 100000000.0];
    const upperLimits = [
      10000000.0,
      30000000.0,
      60000000.0,
      100000000.0,
      double.infinity,
    ];
    const rates = [0.05, 0.10, 0.20, 0.30, 0.35];
    const labels = [
      'Đến 10 triệu',
      'Trên 10–30 triệu',
      'Trên 30–60 triệu',
      'Trên 60–100 triệu',
      'Trên 100 triệu',
    ];

    final details = <_TaxDetail>[];
    for (var index = 0; index < limits.length; index++) {
      if (taxableIncome <= limits[index]) break;
      final amount =
          math.min(taxableIncome, upperLimits[index]) - limits[index];
      details.add(
        _TaxDetail(
          bracket: labels[index],
          taxableAmount: amount,
          rate: rates[index],
          tax: amount * rates[index],
        ),
      );
    }
    return details;
  }

  void _calculate() {
    if (!_formKey.currentState!.validate()) return;

    final income = parseMoneyAmount(_incomeController.text)!;
    final dependents = int.parse(_dependentsController.text.trim());
    final insurance = parseMoneyAmount(_insuranceController.text) ?? 0;
    final taxable = math
        .max(
          0,
          income -
              _personalDeduction -
              dependents * _dependentDeduction -
              insurance,
        )
        .toDouble();
    final tax = _quickTax(taxable);

    setState(() {
      _taxableIncome = taxable;
      _tax = tax;
      _netIncome = income - insurance - tax;
      _details = _buildDetails(taxable);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const PfcAppBar(
        title: Text('Tính thuế thu nhập cá nhân'),
      ),
      body: ResponsiveBody(
        maxWidth: 920,
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              TextFormField(
                controller: _incomeController,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                  labelText: 'Thu nhập từ lương mỗi tháng',
                  suffixText: 'đ',
                ),
                validator: (value) {
                  final income = parseMoneyAmount(value ?? '');
                  if (income == null || income <= 0) {
                    return 'Thu nhập phải là số lớn hơn 0.';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _dependentsController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Số người phụ thuộc',
                  suffixText: 'người',
                ),
                validator: (value) {
                  final dependents = int.tryParse(value?.trim() ?? '');
                  if (dependents == null || dependents < 0) {
                    return 'Số người phụ thuộc phải là số nguyên không âm.';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _insuranceController,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                  labelText: 'Bảo hiểm bắt buộc đã đóng',
                  suffixText: 'đ',
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) return null;
                  final insurance = parseMoneyAmount(value);
                  final income = parseMoneyAmount(_incomeController.text);
                  if (insurance == null || insurance < 0) {
                    return 'Số tiền bảo hiểm không hợp lệ.';
                  }
                  if (income != null && insurance > income) {
                    return 'Bảo hiểm không được lớn hơn thu nhập.';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 20),
              FilledButton.icon(
                onPressed: _calculate,
                icon: const Icon(Icons.calculate_outlined),
                label: const Text('Tính thuế'),
              ),
              if (_taxableIncome != null) ...[
                const SizedBox(height: 20),
                FinancialResultCard(
                  label: 'Thu nhập tính thuế',
                  value: formatVnd(_taxableIncome!),
                  icon: Icons.receipt_long_outlined,
                ),
                FinancialResultCard(
                  label: 'Thuế phải nộp',
                  value: formatVnd(_tax!),
                  icon: Icons.account_balance_outlined,
                  color: Colors.orange.shade800,
                ),
                FinancialResultCard(
                  label: 'Thu nhập thực nhận sau thuế và bảo hiểm',
                  value: formatVnd(_netIncome!),
                  icon: Icons.payments_outlined,
                  color: Colors.green.shade700,
                ),
                const SizedBox(height: 20),
                Text(
                  'Chi tiết các bậc thuế đã áp dụng',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 8),
                if (_details.isEmpty)
                  const Card(
                    child: Padding(
                      padding: EdgeInsets.all(16),
                      child: Text('Không phát sinh thu nhập tính thuế.'),
                    ),
                  )
                else
                  Card(
                    clipBehavior: Clip.antiAlias,
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: DataTable(
                        columns: const [
                          DataColumn(label: Text('Bậc thuế')),
                          DataColumn(
                              label: Text('Phần thu nhập'), numeric: true),
                          DataColumn(label: Text('Thuế suất'), numeric: true),
                          DataColumn(label: Text('Tiền thuế'), numeric: true),
                        ],
                        rows: [
                          for (final detail in _details)
                            DataRow(
                              cells: [
                                DataCell(Text(detail.bracket)),
                                DataCell(Text(formatVnd(detail.taxableAmount))),
                                DataCell(
                                  Text(
                                      '${(detail.rate * 100).toStringAsFixed(0)}%'),
                                ),
                                DataCell(Text(formatVnd(detail.tax))),
                              ],
                            ),
                        ],
                      ),
                    ),
                  ),
              ],
              const SizedBox(height: 20),
              Card(
                color: Theme.of(context).colorScheme.secondaryContainer,
                child: const Padding(
                  padding: EdgeInsets.all(16),
                  child: Text(
                    'Áp dụng biểu thuế lũy tiến 5 bậc theo Luật Thuế thu nhập cá nhân 2025, hiệu lực từ kỳ tính thuế 2026. Chỉ áp dụng cho thu nhập từ tiền lương, tiền công của cá nhân cư trú ký hợp đồng lao động từ 3 tháng trở lên. Đây là công cụ tham khảo, không thay thế tư vấn thuế chính thức.',
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
