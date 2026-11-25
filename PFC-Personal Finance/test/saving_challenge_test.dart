import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:finance_app/models/saving_challenge_model.dart';
import 'package:finance_app/services/saving_challenge_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('evaluateChallengeStatus', () {
    test('thất bại ngay khi số dư ròng thấp hơn mục tiêu', () {
      expect(
        evaluateChallengeStatus(
          challengeType: 'saving',
          progressAmount: 900000,
          targetAmount: 1000000,
          checkedDays: 1,
          durationDays: 7,
        ),
        'failed',
      );
    });

    test('thành công khi đủ ngày và đạt mục tiêu', () {
      expect(
        evaluateChallengeStatus(
          challengeType: 'saving',
          progressAmount: 1200000,
          targetAmount: 1000000,
          checkedDays: 7,
          durationDays: 7,
        ),
        'success',
      );
    });

    test('tiếp tục khi đạt mục tiêu nhưng chưa đủ ngày', () {
      expect(
        evaluateChallengeStatus(
          challengeType: 'saving',
          progressAmount: 1200000,
          targetAmount: 1000000,
          checkedDays: 3,
          durationDays: 7,
        ),
        'active',
      );
    });
  });

  group('thử thách giới hạn chi tiêu', () {
    test('thất bại ngay khi vượt hạn mức', () {
      expect(
        evaluateChallengeStatus(
          challengeType: 'spending_limit',
          progressAmount: 1100000,
          targetAmount: 1000000,
          checkedDays: 2,
          durationDays: 7,
        ),
        'failed',
      );
    });

    test('thành công khi đủ ngày mà không vượt hạn mức', () {
      expect(
        evaluateChallengeStatus(
          challengeType: 'spending_limit',
          progressAmount: 800000,
          targetAmount: 1000000,
          checkedDays: 7,
          durationDays: 7,
        ),
        'success',
      );
    });

    test('tiếp tục khi chưa đủ ngày và chưa vượt hạn mức', () {
      expect(
        evaluateChallengeStatus(
          challengeType: 'spending_limit',
          progressAmount: 800000,
          targetAmount: 1000000,
          checkedDays: 3,
          durationDays: 7,
        ),
        'active',
      );
    });
  });

  test('đọc được checkedDays dạng danh sách của dữ liệu cũ', () {
    final challenge = SavingChallenge.fromMap('challenge-1', {
      'userId': 'user-1',
      'title': 'Thử thách cũ',
      'durationDays': 7,
      'startDate': Timestamp.fromDate(DateTime(2026, 9, 1)),
      'checkedDays': ['2026-09-01', '2026-09-02'],
      'status': 'completed',
    });

    expect(challenge.checkedDays, 2);
    expect(challenge.status, 'success');
    expect(challenge.challengeType, 'saving');
    expect(challenge.lastCheckInDate, DateTime(2026, 9, 2));
  });
}
