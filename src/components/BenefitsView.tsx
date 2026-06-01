import React, { useCallback } from 'react';
import { StyleSheet, Text, View, Alert, ScrollView } from 'react-native';
import { Badge, Button, colors } from '@toss/tds-react-native';
import { contactsViral } from '@apps-in-toss/framework';
import { grantPhotoSlotReward } from '../lib/supabase';
import { RecapMilestone } from '../lib/milestones';

export type RewardAdStatus = 'unsupported' | 'loading' | 'ready' | 'showing' | 'claimed_today' | 'max_reached';

interface BenefitsViewProps {
  userId: string | null;
  streak: number;
  recapAdStatus: RewardAdStatus;
  hasShareReward: boolean;
  onRecapPress: (milestone: RecapMilestone) => void;
  onDebugRecapPress?: () => void;
  onSlotRewardGranted?: () => void;
}

export function BenefitsView({
  userId,
  streak,
  recapAdStatus,
  hasShareReward,
  onRecapPress,
  onDebugRecapPress,
  onSlotRewardGranted,
}: BenefitsViewProps) {
  const handleContactsViral = useCallback(() => {
    if (userId == null || hasShareReward) return;
    try {
      const cleanup = contactsViral({
        options: { moduleId: '5ad21381-2517-4aa6-8136-a3d92cc69420' },
        onEvent: async (event) => {
          if (event.type === 'sendViral') {
            try {
              const result = await grantPhotoSlotReward(userId, 'viral_share');
              if (result === 'granted') {
                Alert.alert('리워드 지급 완료!', '오늘 하루 사진을 1장 더 남길 수 있어요 📸');
                onSlotRewardGranted?.();
              } else {
                Alert.alert('알림', '오늘은 이미 추가 슬롯을 받으셨어요.');
              }
            } catch (e) {
              console.error(e);
              Alert.alert('오류', '리워드 지급에 실패했어요.');
            }
          } else if (event.type === 'close') {
            cleanup();
          }
        },
        onError: (error) => {
          console.error('공유 리워드 에러:', error);
          cleanup?.();
        },
      });
    } catch (error) {
      console.error('공유 리워드 실행 중 에러:', error);
    }
  }, [hasShareReward, userId, onSlotRewardGranted]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>혜택</Text>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>연속 기록 혜택</Text>
        <Text style={styles.sectionHint}>
          목표 일수를 연속으로 기록하면 요약 카드가 바로 열려요.{'\n'}
          기록이 끊겼더라도 광고를 시청하면 열어볼 수 있습니다.
        </Text>
        <View style={styles.card}>
          {([7, 14, 30] as RecapMilestone[]).map((milestone, index) => {
            const unlocked = streak >= milestone;
            const isLast = index === 2;
            const title = milestone === 7 ? '주간 요약' : milestone === 14 ? '2주 요약' : '월간 요약';
            const description =
              milestone === 7
                ? '이번 주 기록과 베스트 샷을 모아봐요.'
                : milestone === 14
                  ? '최근 2주 기록과 베스트 샷을 모아봐요.'
                  : '30일 동안 쌓인 사진, 장소, 베스트 샷을 돌아봐요.';
            const disabled = !unlocked && recapAdStatus === 'showing';
            const buttonLabel = (() => {
              if (unlocked) return '보기';
              if (recapAdStatus === 'unsupported') return '토스 앱 필요';
              if (recapAdStatus === 'loading') return '준비 중';
              return '보기';
            })();

            return (
              <React.Fragment key={milestone}>
                <View style={styles.benefitRow}>
                  <View style={styles.benefitTextBlock}>
                    <View style={styles.benefitTitleRow}>
                      <Text style={styles.rowTitle}>{title}</Text>
                      <Badge size="small" type={unlocked ? 'blue' : 'yellow'} badgeStyle="weak">
                        {unlocked ? '해금' : '광고 시청'}
                      </Badge>
                    </View>
                    <Text style={styles.rowSub}>{description}</Text>
                  </View>
                  <Button
                    type={unlocked ? 'primary' : 'dark'}
                    style="fill"
                    size="tiny"
                    onPress={() => onRecapPress(milestone)}
                    disabled={disabled}
                    loading={!unlocked && recapAdStatus === 'showing'}
                    containerStyle={styles.smallButtonContainer}
                  >
                    {buttonLabel}
                  </Button>
                </View>
                {!isLast && <View style={styles.divider} />}
              </React.Fragment>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>친구 초대</Text>
        <View style={styles.card}>
          <View style={styles.benefitRow}>
            <View style={styles.benefitTextBlock}>
              <View style={styles.benefitTitleRow}>
                <Text style={styles.rowTitle}>친구에게 공유하기</Text>
                <Badge size="small" type="blue" badgeStyle="weak">
                  사진 슬롯 +1
                </Badge>
              </View>
              <Text style={styles.rowSub}>친구에게 오늘의 샷을 알리고 오늘 사진을 한 장 더 남겨요. (하루 1회)</Text>
            </View>
            <Button
              type={hasShareReward ? 'dark' : 'primary'}
              style={hasShareReward ? 'fill' : 'weak'}
              size="tiny"
              onPress={handleContactsViral}
              disabled={hasShareReward}
              containerStyle={styles.smallButtonContainer}
            >
              {hasShareReward ? '오늘 획득 완료' : '공유하기'}
            </Button>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>계정</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowIcon}>🔒</Text>
              <Text style={styles.rowTitle}>내 기록은 안전하게 보관돼요</Text>
            </View>
          </View>
        </View>
      </View>

      {__DEV__ && onDebugRecapPress != null && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DEV</Text>
          <View style={styles.card}>
            <Button
              type="primary"
              style="weak"
              size="medium"
              display="full"
              onPress={onDebugRecapPress}
              viewStyle={styles.debugButton}
              containerStyle={styles.buttonContainer}
            >
              리캡 카드 테스트
            </Button>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.grey50,
  },
  contentContainer: {
    paddingTop: 8,
    paddingBottom: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.grey900,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.grey600,
    paddingHorizontal: 20,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHint: {
    fontSize: 13,
    color: colors.grey500,
    paddingHorizontal: 20,
    marginBottom: 12,
    lineHeight: 19,
  },
  card: {
    backgroundColor: colors.white,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  rowIcon: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.grey600,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.grey900,
  },
  rowSub: {
    fontSize: 13,
    color: colors.grey600,
    marginTop: 6,
    lineHeight: 18,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  benefitTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  benefitTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  divider: {
    height: 1,
    backgroundColor: colors.grey100,
    marginHorizontal: 16,
  },
  debugButton: {
    margin: 12,
  },
  buttonContainer: {
    borderRadius: 10,
  },
  smallButtonContainer: {
    borderRadius: 10,
  },
});
