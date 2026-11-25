class CategoryModel {
  final String id;
  final String userId;
  final String name;
  final String icon;
  final String type;

  const CategoryModel({
    required this.id,
    required this.userId,
    required this.name,
    required this.icon,
    required this.type,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'userId': userId,
      'name': name,
      'icon': icon,
      'type': type,
    };
  }

  factory CategoryModel.fromMap(String id, Map<String, dynamic> map) {
    return CategoryModel(
      id: map['id'] as String? ?? id,
      userId: map['userId'] as String? ?? '',
      name: map['name'] as String? ?? '',
      icon: map['icon'] as String? ?? 'category',
      type: map['type'] as String? ?? 'expense',
    );
  }
}
