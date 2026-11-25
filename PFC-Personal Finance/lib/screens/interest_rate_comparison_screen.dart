import 'package:flutter/material.dart';

import '../data/bank_rates.dart';
import '../widgets/responsive.dart';
import '../widgets/pfc_app_bar.dart';

class InterestRateComparisonScreen extends StatefulWidget {
  const InterestRateComparisonScreen({super.key});

  @override
  State<InterestRateComparisonScreen> createState() =>
      _InterestRateComparisonScreenState();
}

class _InterestRateComparisonScreenState
    extends State<InterestRateComparisonScreen> {
  int _termMonths = 12;

  List<BankRate> get _sortedRates {
    return [...bankRatesSeptember2026]..sort(
        (a, b) => b
            .rateForMonths(_termMonths)
            .compareTo(a.rateForMonths(_termMonths)),
      );
  }

  @override
  Widget build(BuildContext context) {
    final rates = _sortedRates;

    return Scaffold(
      appBar: const PfcAppBar(
        title: Text('So sánh lãi suất ngân hàng'),
      ),
      body: ResponsiveBody(
        maxWidth: 820,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            DropdownButtonFormField<int>(
              initialValue: _termMonths,
              decoration: const InputDecoration(labelText: 'Kỳ hạn gửi'),
              items: const [
                DropdownMenuItem(value: 3, child: Text('3 tháng')),
                DropdownMenuItem(value: 6, child: Text('6 tháng')),
                DropdownMenuItem(value: 12, child: Text('12 tháng')),
              ],
              onChanged: (value) {
                if (value != null) setState(() => _termMonths = value);
              },
            ),
            const SizedBox(height: 16),
            Card(
              color: Theme.of(context).colorScheme.secondaryContainer,
              child: const Padding(
                padding: EdgeInsets.all(12),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.info_outline),
                    SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Dữ liệu tĩnh tham khảo tháng 09/2026, không phải dữ liệu thời gian thực. Lãi suất thực tế có thể thay đổi; cần kiểm tra lại với ngân hàng.',
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            Card(
              clipBehavior: Clip.antiAlias,
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: DataTable(
                  columns: const [
                    DataColumn(label: Text('Xếp hạng')),
                    DataColumn(label: Text('Ngân hàng')),
                    DataColumn(label: Text('Lãi suất/năm'), numeric: true),
                  ],
                  rows: [
                    for (var index = 0; index < rates.length; index++)
                      DataRow(
                        cells: [
                          DataCell(Text('${index + 1}')),
                          DataCell(Text(rates[index].bank)),
                          DataCell(
                            Text(
                              '${rates[index].rateForMonths(_termMonths).toStringAsFixed(2)}%',
                              style: TextStyle(
                                color:
                                    index == 0 ? Colors.green.shade700 : null,
                                fontWeight: index == 0 ? FontWeight.w700 : null,
                              ),
                            ),
                          ),
                        ],
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
