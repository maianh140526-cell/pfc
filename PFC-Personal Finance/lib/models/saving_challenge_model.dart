import 'package:cloud_firestore/cloud_firestore.dart';

class SavingChallenge {
  final String id;
  final String userId;
  final String title;
  final String challengeType;
  final double targetAmount;
  final int durationDays;
  final DateTime startDate;
  final DateTime? firstCheckInDate;
  final DateTime? lastCheckInDate;
  final int checkedDays;
  final double progressAmount;
  final String status;

  const SavingChallenge({
    required this.id,
    required this.userId,
    required this.title,
    required this.challengeType,
    required this.targetAmount,
    required this.durationDays,
    required this.startDate,
    required this.firstCheckInDate,
    required this.lastCheckInDate,
    required this.checkedDays,
    required this.progressAmount,
    required this.status,
  });

  bool get isSpendingLimit => challengeType == 'spending_limit';

  bool get isSuccess => status == 'success';

  bool get isFailed => status == 'failed';

  bool get isFinished => isSuccess || isFailed;

  bool get checkedInToday {
    final lastDate = lastCheckInDate;
    if (lastDate == null) return false;
    final today = DateTime.now();
    return lastDate.year == today.year &&
        lastDate.month == today.month &&
        lastDate.day == today.day;
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'userId': userId,
      'title': title,
      'challengeType': challengeType,
      'targetAmount': targetAmount,
      'durationDays': durationDays,
      'startDate': Timestamp.fromDate(startDate),
      'firstCheckInDate': firstCheckInDate == null
          ? null
          : Timestamp.fromDate(firstCheckInDate!),
      'lastCheckInDate':
          lastCheckInDate == null ? null : Timestamp.fromDate(lastCheckInDate!),
      'checkedDays': checkedDays,
      'progressAmount': progressAmount,
      'status': status,
    };
  }

  factory SavingChallenge.fromMap(String id, Map<String, dynamic> map) {
    final startDate = map['startDate'];
    final rawDays = map['checkedDays'];
    final firstCheckInDate = map['firstCheckInDate'];
    final lastCheckInDate = map['lastCheckInDate'];
    final legacyDays = rawDays is List
        ? (rawDays.map((item) => item.toString()).toList()..sort())
        : const <String>[];
    final rawStatus = map['status'] as String? ?? 'active';
    final rawType = map['challengeType'] as String?;

    return SavingChallenge(
      id: map['id'] as String? ?? id,
      userId: map['userId'] as String? ?? '',
      title: map['title'] as String? ?? '',
      challengeType: rawType == 'spending_limit' ? 'spending_limit' : 'saving',
      targetAmount: (map['targetAmount'] as num?)?.toDouble() ?? 0,
      durationDays: (map['durationDays'] as num?)?.toInt() ?? 0,
      startDate: startDate is Timestamp
          ? startDate.toDate()
          : DateTime.tryParse(startDate?.toString() ?? '') ?? DateTime.now(),
      firstCheckInDate: firstCheckInDate is Timestamp
          ? firstCheckInDate.toDate()
          : DateTime.tryParse(firstCheckInDate?.toString() ?? '') ??
              (legacyDays.isEmpty ? null : DateTime.tryParse(legacyDays.first)),
      lastCheckInDate: lastCheckInDate is Timestamp
          ? lastCheckInDate.toDate()
          : DateTime.tryParse(lastCheckInDate?.toString() ?? '') ??
              (legacyDays.isEmpty ? null : DateTime.tryParse(legacyDays.last)),
      checkedDays: rawDays is num ? rawDays.toInt() : legacyDays.length,
      progressAmount: (map['progressAmount'] as num?)?.toDouble() ??
          (map['netAmount'] as num?)?.toDouble() ??
          0,
      status: rawStatus == 'completed' ? 'success' : rawStatus,
    );
  }
}
