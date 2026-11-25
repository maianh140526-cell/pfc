import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../models/transaction_model.dart';

class TransactionService {
  TransactionService({
    FirebaseFirestore? firestore,
    FirebaseAuth? auth,
  })  : _firestore = firestore ?? FirebaseFirestore.instance,
        _auth = auth ?? FirebaseAuth.instance;

  final FirebaseFirestore _firestore;
  final FirebaseAuth _auth;

  CollectionReference<Map<String, dynamic>> get _collection =>
      _firestore.collection('transactions');

  String get _uid {
    final uid = _auth.currentUser?.uid;
    if (uid == null) {
      throw StateError('Chưa đăng nhập.');
    }
    return uid;
  }

  Future<void> addTransaction(TransactionModel transaction) async {
    final uid = _uid;
    if (transaction.userId != uid) {
      throw StateError('Không thể thêm giao dịch của người khác.');
    }
    final doc = _collection.doc();
    final data = transaction.copyWith(id: doc.id, userId: uid).toMap();
    await doc.set(data);
  }

  Future<void> updateTransaction(TransactionModel transaction) async {
    final uid = _uid;
    if (transaction.userId != uid) {
      throw StateError('Không thể sửa giao dịch của người khác.');
    }
    await _collection.doc(transaction.id).update(transaction.toMap());
  }

  Future<void> deleteTransaction(String id) async {
    final uid = _uid;
    final snapshot = await _collection.doc(id).get();
    final data = snapshot.data();
    if (data == null) return;
    if (data['userId'] != uid) {
      throw StateError('Không thể xóa giao dịch của người khác.');
    }
    await _collection.doc(id).delete();
  }

  Future<List<TransactionModel>> getTransactionsInRange({
    required String userId,
    required DateTime start,
    required DateTime end,
  }) async {
    final uid = _uid;
    if (userId != uid) {
      throw StateError('Không thể đọc giao dịch của người khác.');
    }

    final snapshot = await _collection.where('userId', isEqualTo: uid).get();
    return snapshot.docs
        .map((doc) => TransactionModel.fromMap(doc.id, doc.data()))
        .where(
          (item) => !item.date.isBefore(start) && !item.date.isAfter(end),
        )
        .toList();
  }

  Stream<List<TransactionModel>> getTransactionsStream(String userId) {
    final uid = _auth.currentUser?.uid;
    if (uid == null || uid != userId) {
      return Stream.value(const []);
    }

    return _collection
        .where('userId', isEqualTo: uid)
        .snapshots()
        .map((snapshot) {
      final items = snapshot.docs
          .map((doc) => TransactionModel.fromMap(doc.id, doc.data()))
          .where((item) => item.userId == uid)
          .toList()
        ..sort((a, b) => b.date.compareTo(a.date));
      return items;
    });
  }
}
