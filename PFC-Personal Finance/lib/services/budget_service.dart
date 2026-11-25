import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../models/budget_model.dart';
import '../models/transaction_model.dart';

class BudgetService {
  BudgetService({
    FirebaseFirestore? firestore,
    FirebaseAuth? auth,
  })  : _firestore = firestore ?? FirebaseFirestore.instance,
        _auth = auth ?? FirebaseAuth.instance;

  final FirebaseFirestore _firestore;
  final FirebaseAuth _auth;

  CollectionReference<Map<String, dynamic>> get _budgets =>
      _firestore.collection('budgets');

  CollectionReference<Map<String, dynamic>> get _transactions =>
      _firestore.collection('transactions');

  CollectionReference<Map<String, dynamic>> get _categories =>
      _firestore.collection('categories');

  String get _uid {
    final uid = _auth.currentUser?.uid;
    if (uid == null) {
      throw StateError('Chưa đăng nhập.');
    }
    return uid;
  }

  Future<void> addBudget(BudgetModel budget) async {
    final uid = _uid;
    if (budget.userId != uid) {
      throw StateError('Không thể thêm ngân sách của người khác.');
    }

    final existing = await _budgets.where('userId', isEqualTo: uid).get();
    final duplicate = existing.docs.any((doc) {
      final data = doc.data();
      return data['month'] == budget.month &&
          data['categoryId'] == budget.categoryId;
    });
    if (duplicate) {
      throw StateError('Danh mục này đã có ngân sách trong tháng.');
    }

    final doc = _budgets.doc();
    await doc.set(
      BudgetModel(
        id: doc.id,
        userId: uid,
        categoryId: budget.categoryId,
        categoryName: budget.categoryName,
        limitAmount: budget.limitAmount,
        month: budget.month,
      ).toMap(),
    );
  }

  Future<void> updateBudget(BudgetModel budget) async {
    final uid = _uid;
    if (budget.userId != uid) {
      throw StateError('Không thể sửa ngân sách của người khác.');
    }
    await _budgets.doc(budget.id).update(budget.toMap());
  }

  Future<void> deleteBudget(String id) async {
    final uid = _uid;
    final snapshot = await _budgets.doc(id).get();
    final data = snapshot.data();
    if (data == null) return;
    if (data['userId'] != uid) {
      throw StateError('Không thể xóa ngân sách của người khác.');
    }
    await _budgets.doc(id).delete();
  }

  Stream<List<BudgetModel>> getBudgetsStream(String userId, String month) {
    final uid = _auth.currentUser?.uid;
    if (uid == null || uid != userId) {
      return Stream.value(const []);
    }

    return _budgets.where('userId', isEqualTo: uid).snapshots().map((snapshot) {
      return snapshot.docs
          .map((doc) => BudgetModel.fromMap(doc.id, doc.data()))
          .where((item) => item.userId == uid && item.month == month)
          .toList()
        ..sort((a, b) => a.categoryName.compareTo(b.categoryName));
    });
  }

  Future<BudgetModel?> findBudget({
    required String userId,
    required String month,
    String? categoryId,
    String? categoryName,
  }) async {
    final uid = _auth.currentUser?.uid;
    if (uid == null || uid != userId) return null;

    final snapshot = await _budgets.where('userId', isEqualTo: uid).get();
    for (final doc in snapshot.docs) {
      final item = BudgetModel.fromMap(doc.id, doc.data());
      if (item.month != month) continue;
      if (categoryId != null && item.categoryId == categoryId) return item;
      if (categoryName != null && item.categoryName == categoryName) {
        return item;
      }
    }
    return null;
  }

  Future<double> calculateSpent(
    String userId,
    String categoryId,
    String month,
  ) async {
    final uid = _auth.currentUser?.uid;
    if (uid == null || uid != userId) return 0;

    var categoryName = '';
    final categoryDoc = await _categories.doc(categoryId).get();
    final categoryData = categoryDoc.data();
    if (categoryData != null && categoryData['userId'] == uid) {
      categoryName = categoryData['name'] as String? ?? '';
    }

    final snapshot = await _transactions.where('userId', isEqualTo: uid).get();
    var total = 0.0;
    for (final doc in snapshot.docs) {
      final item = TransactionModel.fromMap(doc.id, doc.data());
      if (item.userId != uid || item.type != 'expense') continue;
      if (BudgetModel.monthKey(item.date) != month) continue;
      if (item.category == categoryName || item.category == categoryId) {
        total += item.amount;
      }
    }
    return total;
  }

  double spentFromTransactions({
    required List<TransactionModel> transactions,
    required String userId,
    required String categoryId,
    required String categoryName,
    required String month,
  }) {
    var total = 0.0;
    for (final item in transactions) {
      if (item.userId != userId || item.type != 'expense') continue;
      if (BudgetModel.monthKey(item.date) != month) continue;
      if (item.category == categoryName || item.category == categoryId) {
        total += item.amount;
      }
    }
    return total;
  }
}
