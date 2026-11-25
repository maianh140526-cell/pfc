import 'package:finance_app/models/saving_goal_model.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('SavingGoal.progressPercent', () {
    SavingGoal goal(double current, double target) {
      return SavingGoal(
        id: 'goal-1',
        userId: 'user-1',
        name: 'Quỹ dự phòng',
        targetAmount: target,
        currentAmount: current,
        deadline: DateTime(2030),
      );
    }

    test('tính phần trăm đang thực hiện', () {
      expect(goal(4700000, 10000000).progressPercent, 47);
    });

    test('giới hạn mục tiêu vượt mức ở 100 phần trăm', () {
      expect(goal(12000000, 10000000).progressPercent, 100);
    });

    test('trả về 0 khi số tiền mục tiêu không hợp lệ', () {
      expect(goal(1000000, 0).progressPercent, 0);
    });
  });
}
