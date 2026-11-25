import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../models/saving_goal_model.dart';

class SavingGoalService {
  SavingGoalService({
    FirebaseFirestore? firestore,
    FirebaseAuth? auth,
  })  : _firestore = firestore ?? FirebaseFirestore.instance,
        _auth = auth ?? FirebaseAuth.instance;

  final FirebaseFirestore _firestore;
  final FirebaseAuth _auth;

  CollectionReference<Map<String, dynamic>> get _collection =>
      _firestore.collection('saving_goals');

  String get _uid {
    final uid = _auth.currentUser?.uid;
    if (uid == null) {
      throw StateError('Chưa đăng nhập.');
    }
    return uid;
  }

  Future<void> addGoal(SavingGoal goal) async {
    final uid = _uid;
    if (goal.userId != uid) {
      throw StateError('Không thể thêm mục tiêu của người khác.');
    }
    final doc = _collection.doc();
    await doc.set(goal.copyWith(id: doc.id, userId: uid).toMap());
  }

  Future<void> updateGoal(SavingGoal goal) async {
    final uid = _uid;
    if (goal.userId != uid) {
      throw StateError('Không thể sửa mục tiêu của người khác.');
    }
    await _collection.doc(goal.id).update(goal.toMap());
  }

  Future<void> deleteGoal(String id) async {
    final uid = _uid;
    final snapshot = await _collection.doc(id).get();
    final data = snapshot.data();
    if (data == null) return;
    if (data['userId'] != uid) {
      throw StateError('Không thể xóa mục tiêu của người khác.');
    }
    await _collection.doc(id).delete();
  }

  Stream<List<SavingGoal>> getGoalsStream(String userId) {
    final uid = _auth.currentUser?.uid;
    if (uid == null || uid != userId) {
      return Stream.value(const []);
    }

    return _collection
        .where('userId', isEqualTo: uid)
        .snapshots()
        .map((snapshot) {
      return snapshot.docs
          .map((doc) => SavingGoal.fromMap(doc.id, doc.data()))
          .where((item) => item.userId == uid)
          .toList()
        ..sort((a, b) => a.deadline.compareTo(b.deadline));
    });
  }
}
