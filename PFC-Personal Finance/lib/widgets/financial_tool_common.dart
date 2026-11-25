import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

final NumberFormat _vndFormat = NumberFormat.currency(
  locale: 'vi_VN',
  symbol: 'đ',
  decimalDigits: 0,
);

String formatVnd(num value) => _vndFormat.format(value);

double? parseFinancialNumber(String value) {
  var normalized = value.trim().replaceAll(' ', '');
  if (normalized.isEmpty) return null;

  if (normalized.contains(',')) {
    normalized = normalized.replaceAll('.', '').replaceAll(',', '.');
  } else if ('.'.allMatches(normalized).length > 1) {
    normalized = normalized.replaceAll('.', '');
  }
  return double.tryParse(normalized);
}

double? parseMoneyAmount(String value) {
  var normalized = value.trim().replaceAll(' ', '');
  if (normalized.isEmpty) return null;

  if (normalized.contains(',')) {
    normalized = normalized.replaceAll('.', '').replaceAll(',', '.');
  } else {
    normalized = normalized.replaceAll('.', '');
  }
  return double.tryParse(normalized);
}

class FinancialResultCard extends StatelessWidget {
  const FinancialResultCard({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    this.color,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final itemColor = color ?? Theme.of(context).colorScheme.primary;
    return Card(
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: itemColor.withValues(alpha: 0.12),
          child: Icon(icon, color: itemColor),
        ),
        title: Text(label),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Text(
            value,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  color: itemColor,
                  fontWeight: FontWeight.w700,
                ),
          ),
        ),
      ),
    );
  }
}
