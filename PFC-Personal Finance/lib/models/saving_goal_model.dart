import 'package:cloud_firestore/cloud_firestore.dart';

class SavingGoal {
  final String id;
  final String userId;
  final String name;
  final double targetAmount;
  final double currentAmount;
  final DateTime deadline;

  const SavingGoal({
    required this.id,
    required this.userId,
    required this.name,
    required this.targetAmount,
    required this.currentAmount,
    required this.deadline,
  });

  double get progress =>
      targetAmount <= 0 ? 0 : (currentAmount / targetAmount).clamp(0, 1);

  double get progressPercent => targetAmount <= 0
      ? 0
      : (currentAmount / targetAmount * 100).clamp(0, 100).toDouble();

  int get daysLeft {
    final today = DateTime.now();
    final startOfToday = DateTime(today.year, today.month, today.day);
    final due = DateTime(deadline.year, deadline.month, deadline.day);
    return due.difference(startOfToday).inDays;
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'userId': userId,
      'name': name,
      'targetAmount': targetAmount,
      'currentAmount': currentAmount,
      'deadline': Timestamp.fromDate(deadline),
    };
  }

  factory SavingGoal.fromMap(String id, Map<String, dynamic> map) {
    final deadline = map['deadline'];
    return SavingGoal(
      id: map['id'] as String? ?? id,
      userId: map['userId'] as String? ?? '',
      name: map['name'] as String? ?? '',
      targetAmount: (map['targetAmount'] as num?)?.toDouble() ?? 0,
      currentAmount: (map['currentAmount'] as num?)?.toDouble() ?? 0,
      deadline: deadline is Timestamp
          ? deadline.toDate()
          : DateTime.tryParse(deadline?.toString() ?? '') ?? DateTime.now(),
    );
  }

  SavingGoal copyWith({
    String? id,
    String? userId,
    String? name,
    double? targetAmount,
    double? currentAmount,
    DateTime? deadline,
  }) {
    return SavingGoal(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      name: name ?? this.name,
      targetAmount: targetAmount ?? this.targetAmount,
      currentAmount: currentAmount ?? this.currentAmount,
      deadline: deadline ?? this.deadline,
    );
  }
}
