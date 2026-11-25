class BudgetModel {
  final String id;
  final String userId;
  final String categoryId;
  final String categoryName;
  final double limitAmount;
  final String month;

  const BudgetModel({
    required this.id,
    required this.userId,
    required this.categoryId,
    required this.categoryName,
    required this.limitAmount,
    required this.month,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'userId': userId,
      'categoryId': categoryId,
      'categoryName': categoryName,
      'limitAmount': limitAmount,
      'month': month,
    };
  }

  factory BudgetModel.fromMap(String id, Map<String, dynamic> map) {
    return BudgetModel(
      id: map['id'] as String? ?? id,
      userId: map['userId'] as String? ?? '',
      categoryId: map['categoryId'] as String? ?? '',
      categoryName: map['categoryName'] as String? ?? '',
      limitAmount: (map['limitAmount'] as num?)?.toDouble() ?? 0,
      month: map['month'] as String? ?? '',
    );
  }

  static String monthKey(DateTime date) {
    final month = date.month.toString().padLeft(2, '0');
    return '${date.year}-$month';
  }
}
