import 'package:finance_app/utils/greeting_helper.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('lời chào thay đổi theo các mốc giờ trong ngày', () {
    expect(getGreeting(DateTime(2026, 9, 15, 5)), 'Chào buổi sáng');
    expect(getGreeting(DateTime(2026, 9, 15, 11)), 'Chào buổi trưa');
    expect(getGreeting(DateTime(2026, 9, 15, 14)), 'Chào buổi chiều');
    expect(getGreeting(DateTime(2026, 9, 15, 18)), 'Chào buổi tối');
    expect(getGreeting(DateTime(2026, 9, 15, 4)), 'Chào buổi tối');
  });
}
