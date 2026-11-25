import 'package:cloud_firestore/cloud_firestore.dart';

class TransactionModel {
  final String id;
  final String userId;
  final String type;
  final double amount;
  final String category;
  final String note;
  final DateTime date;

  const TransactionModel({
    required this.id,
    required this.userId,
    required this.type,
    required this.amount,
    required this.category,
    required this.note,
    required this.date,
  });

  bool get isIncome => type == 'income';

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'userId': userId,
      'type': type,
      'amount': amount,
      'category': category,
      'note': note,
      'date': Timestamp.fromDate(date),
    };
  }

  factory TransactionModel.fromMap(String id, Map<String, dynamic> map) {
    final date = map['date'];
    return TransactionModel(
      id: map['id'] as String? ?? id,
      userId: map['userId'] as String? ?? '',
      type: map['type'] as String? ?? 'expense',
      amount: (map['amount'] as num?)?.toDouble() ?? 0,
      category: map['category'] as String? ?? '',
      note: map['note'] as String? ?? '',
      date: date is Timestamp
          ? date.toDate()
          : DateTime.tryParse(date?.toString() ?? '') ?? DateTime.now(),
    );
  }

  TransactionModel copyWith({
    String? id,
    String? userId,
    String? type,
    double? amount,
    String? category,
    String? note,
    DateTime? date,
  }) {
    return TransactionModel(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      type: type ?? this.type,
      amount: amount ?? this.amount,
      category: category ?? this.category,
      note: note ?? this.note,
      date: date ?? this.date,
    );
  }
}
