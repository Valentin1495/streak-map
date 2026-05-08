import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Photo } from '../lib/supabase';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function toKstDateString(date: Date): string {
  const kstOffset = 9 * 60 * 60 * 1000;
  return new Date(date.getTime() + kstOffset).toISOString().slice(0, 10);
}

function subtractDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

interface DayInfo {
  dateStr: string;
  dayLabel: string;
  dayNum: number;
  hasPhoto: boolean;
  isToday: boolean;
}

interface WeekStripProps {
  photos: Photo[];
}

export function WeekStrip({ photos }: WeekStripProps) {
  const today = toKstDateString(new Date());
  const recordedDates = new Set(photos.map((p) => p.streak_date));

  const days: DayInfo[] = Array.from({ length: 7 }, (_, i) => {
    const dateStr = subtractDays(today, 6 - i);
    const dateObj = new Date(`${dateStr}T00:00:00Z`);
    return {
      dateStr,
      dayLabel: DAY_LABELS[dateObj.getUTCDay()] ?? '?',
      dayNum: dateObj.getUTCDate(),
      hasPhoto: recordedDates.has(dateStr),
      isToday: dateStr === today,
    };
  });

  return (
    <View style={styles.container}>
      {days.map((day) => (
        <View key={day.dateStr} style={styles.dayCol}>
          <Text style={[styles.dayLabel, day.isToday && styles.dayLabelToday]}>{day.dayLabel}</Text>
          <View
            style={[
              styles.circle,
              day.hasPhoto && styles.circleActive,
              day.isToday && !day.hasPhoto && styles.circleToday,
            ]}
          >
            <Text style={[styles.dayNum, day.hasPhoto && styles.dayNumActive]}>
              {day.dayNum}
            </Text>
          </View>
          {day.isToday && <View style={styles.todayDot} />}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'white',
    marginHorizontal: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  dayCol: {
    alignItems: 'center',
    gap: 6,
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  dayLabelToday: {
    color: '#0064FF',
  },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleActive: {
    backgroundColor: '#0064FF',
  },
  circleToday: {
    borderWidth: 2,
    borderColor: '#0064FF',
    backgroundColor: '#EFF6FF',
  },
  dayNum: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
  },
  dayNumActive: {
    color: 'white',
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#0064FF',
    marginTop: -4,
  },
});
