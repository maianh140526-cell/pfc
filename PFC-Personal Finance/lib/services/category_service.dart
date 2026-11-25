import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../models/category_model.dart';

List<CategoryModel> uniqueCategoriesForType(
  Iterable<CategoryModel> categories,
  String type,
) {
  final unique = <String, CategoryModel>{};
  for (final category in categories) {
    if (category.type != type) continue;
    final normalizedName = category.name.trim().toLowerCase();
    if (normalizedName.isEmpty) continue;
    unique.putIfAbsent(normalizedName, () => category);
  }
  return unique.values.toList()
    ..sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
}

class CategoryService {
  CategoryService({
    FirebaseFirestore? firestore,
    FirebaseAuth? auth,
  })  : _firestore = firestore ?? FirebaseFirestore.instance,
        _auth = auth ?? FirebaseAuth.instance;

  final FirebaseFirestore _firestore;
  final FirebaseAuth _auth;

  CollectionReference<Map<String, dynamic>> get _collection =>
      _firestore.collection('categories');

  String get _uid {
    final uid = _auth.currentUser?.uid;
    if (uid == null) {
      throw StateError('Chưa đăng nhập.');
    }
    return uid;
  }

  Future<void> addCategory(CategoryModel category) async {
    final uid = _uid;
    if (category.userId != uid) {
      throw StateError('Không thể thêm danh mục của người khác.');
    }
    final doc = _collection.doc();
    await doc.set(
      CategoryModel(
        id: doc.id,
        userId: uid,
        name: category.name,
        icon: category.icon,
        type: category.type,
      ).toMap(),
    );
  }

  Future<void> updateCategory(CategoryModel category) async {
    final uid = _uid;
    if (category.userId != uid) {
      throw StateError('Không thể sửa danh mục của người khác.');
    }
    await _collection.doc(category.id).update(category.toMap());
  }

  Future<void> deleteCategory(String id) async {
    final uid = _uid;
    final snapshot = await _collection.doc(id).get();
    final data = snapshot.data();
    if (data == null) return;
    if (data['userId'] != uid) {
      throw StateError('Không thể xóa danh mục của người khác.');
    }
    await _collection.doc(id).delete();
  }

  Stream<List<CategoryModel>> getCategoriesStream(String userId) {
    final uid = _auth.currentUser?.uid;
    if (uid == null || uid != userId) {
      return Stream.value(const []);
    }

    return _collection
        .where('userId', isEqualTo: uid)
        .snapshots()
        .map((snapshot) {
      return snapshot.docs
          .map((doc) => CategoryModel.fromMap(doc.id, doc.data()))
          .where((item) => item.userId == uid)
          .toList();
    });
  }

  Future<void> seedDefaultCategories(String userId) async {
    final uid = _auth.currentUser?.uid;
    if (uid == null || uid != userId) return;

    final existing = await _collection.where('userId', isEqualTo: uid).get();

    final defaults = <({String key, String name, String icon, String type})>[
      (
        key: 'expense_food',
        name: 'Ăn uống',
        icon: 'restaurant',
        type: 'expense'
      ),
      (
        key: 'expense_transport',
        name: 'Di chuyển',
        icon: 'directions_car',
        type: 'expense',
      ),
      (
        key: 'expense_shopping',
        name: 'Mua sắm',
        icon: 'shopping_bag',
        type: 'expense',
      ),
      (key: 'expense_home', name: 'Nhà cửa', icon: 'home', type: 'expense'),
      (
        key: 'expense_health',
        name: 'Y tế',
        icon: 'medical_services',
        type: 'expense',
      ),
      (
        key: 'expense_education',
        name: 'Giáo dục',
        icon: 'school',
        type: 'expense'
      ),
      (
        key: 'expense_entertainment',
        name: 'Giải trí',
        icon: 'sports_esports',
        type: 'expense',
      ),
      (key: 'expense_bills', name: 'Hóa đơn', icon: 'bolt', type: 'expense'),
      (key: 'income_salary', name: 'Lương', icon: 'payments', type: 'income'),
      (
        key: 'income_bonus',
        name: 'Thưởng',
        icon: 'card_giftcard',
        type: 'income',
      ),
      (
        key: 'income_investment',
        name: 'Đầu tư',
        icon: 'trending_up',
        type: 'income'
      ),
      (key: 'income_other', name: 'Khác', icon: 'more_horiz', type: 'income'),
    ];

    final existingKeys = existing.docs.map((doc) {
      final data = doc.data();
      final type = (data['type'] as String? ?? '').trim().toLowerCase();
      final name = (data['name'] as String? ?? '').trim().toLowerCase();
      return '$type\u0000$name';
    }).toSet();

    final batch = _firestore.batch();
    for (final category in defaults) {
      final categoryKey =
          '${category.type}\u0000${category.name.trim().toLowerCase()}';
      if (existingKeys.contains(categoryKey)) continue;

      // A deterministic document ID makes concurrent seed calls idempotent.
      final doc = _collection.doc('${uid}_${category.key}');
      batch.set(
        doc,
        CategoryModel(
          id: doc.id,
          userId: uid,
          name: category.name,
          icon: category.icon,
          type: category.type,
        ).toMap(),
        SetOptions(merge: true),
      );
    }
    await batch.commit();
  }
}
