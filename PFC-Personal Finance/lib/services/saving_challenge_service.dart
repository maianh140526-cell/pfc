import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../models/saving_challenge_model.dart';
import 'transaction_service.dart';

String evaluateChallengeStatus({
  required String challengeType,
  required double progressAmount,
  required double targetAmount,
  required int checkedDays,
  required int durationDays,
}) {
  if (challengeType == 'spending_limit') {
    if (progressAmount > targetAmount) return 'failed';
    if (checkedDays >= durationDays && progressAmount <= targetAmount) {
      return 'success';
    }
    return 'active';
  }

  if (progressAmount < targetAmount) return 'failed';
  if (checkedDays >= durationDays && progressAmount >= targetAmount) {
    return 'success';
  }
  return 'active';
}

class SavingChallengeService {
  SavingChallengeService({
    FirebaseFirestore? firestore,
    FirebaseAuth? auth,
    TransactionService? transactionService,
  })  : _firestore = firestore ?? FirebaseFirestore.instance,
        _auth = auth ?? FirebaseAuth.instance,
        _transactionService = transactionService ??
            TransactionService(firestore: firestore, auth: auth);

  final FirebaseFirestore _firestore;
  final FirebaseAuth _auth;
  final TransactionService _transactionService;

  CollectionReference<Map<String, dynamic>> get _collection =>
      _firestore.collection('saving_challenges');

  String get _uid {
    final uid = _auth.currentUser?.uid;
    if (uid == null) {
      throw StateError('Chưa đăng nhập.');
    }
    return uid;
  }

  Future<void> addChallenge(SavingChallenge challenge) async {
    final uid = _uid;
    if (challenge.userId != uid) {
      throw StateError('Không thể thêm thử thách của người khác.');
    }
    final doc = _collection.doc();
    await doc.set(
      SavingChallenge(
        id: doc.id,
        userId: uid,
        title: challenge.title,
        challengeType: challenge.challengeType,
        targetAmount: challenge.targetAmount,
        durationDays: challenge.durationDays,
        startDate: challenge.startDate,
        firstCheckInDate: challenge.firstCheckInDate,
        lastCheckInDate: challenge.lastCheckInDate,
        checkedDays: challenge.checkedDays,
        progressAmount: challenge.progressAmount,
        status: challenge.status,
      ).toMap(),
    );
  }

  Future<void> checkInToday(String challengeId) async {
    final uid = _uid;
    final snapshot = await _collection.doc(challengeId).get();
    final data = snapshot.data();
    if (data == null) {
      throw StateError('Không tìm thấy thử thách.');
    }
    if (data['userId'] != uid) {
      throw StateError('Không thể check-in thử thách của người khác.');
    }

    final challenge = SavingChallenge.fromMap(snapshot.id, data);
    if (challenge.status != 'active' || challenge.checkedInToday) return;

    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final endOfToday = today
        .add(const Duration(days: 1))
        .subtract(const Duration(microseconds: 1));
    final firstCheckInDate = challenge.firstCheckInDate ?? today;
    final transactions = await _transactionService.getTransactionsInRange(
      userId: uid,
      start: firstCheckInDate,
      end: endOfToday,
    );
    final progressAmount = transactions.fold<double>(0, (total, transaction) {
      if (challenge.isSpendingLimit) {
        return transaction.isIncome ? total : total + transaction.amount;
      }
      return total +
          (transaction.isIncome ? transaction.amount : -transaction.amount);
    });
    final checkedDays = challenge.checkedDays + 1;

    final status = evaluateChallengeStatus(
      challengeType: challenge.challengeType,
      progressAmount: progressAmount,
      targetAmount: challenge.targetAmount,
      checkedDays: checkedDays,
      durationDays: challenge.durationDays,
    );

    await _collection.doc(challengeId).update({
      'firstCheckInDate': Timestamp.fromDate(firstCheckInDate),
      'lastCheckInDate': Timestamp.fromDate(today),
      'checkedDays': checkedDays,
      'progressAmount': progressAmount,
      'status': status,
    });
  }

  Future<void> deleteChallenge(String challengeId) async {
    final uid = _uid;
    final snapshot = await _collection.doc(challengeId).get();
    final data = snapshot.data();
    if (data == null) return;
    if (data['userId'] != uid) {
      throw StateError('Không thể xóa thử thách của người khác.');
    }
    await _collection.doc(challengeId).delete();
  }

  Stream<List<SavingChallenge>> getChallengesStream(String userId) {
    final uid = _auth.currentUser?.uid;
    if (uid == null || uid != userId) {
      return Stream.value(const []);
    }

    return _collection
        .where('userId', isEqualTo: uid)
        .snapshots()
        .map((snapshot) {
      return snapshot.docs
          .map((doc) => SavingChallenge.fromMap(doc.id, doc.data()))
          .where((item) => item.userId == uid)
          .toList()
        ..sort((a, b) => b.startDate.compareTo(a.startDate));
    });
  }
}
