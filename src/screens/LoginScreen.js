import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Dimensions,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { apiUrl } from '../api/config';
import { useAuth } from '../context/AuthContext';
import { colors, radii, shadow } from '../theme/theme';

const { width: SCREEN_W } = Dimensions.get('window');

/*
 * Put the uploaded HISTree logo here:
 *
 *   assets/HISTree-logo.png
 *
 * Then this require will work:
 */
const HISTREE_LOGO = require('../assets/HISTree-logo.png');

export default function LoginScreen() {
  const { login } = useAuth();

  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState('');

  // Entrance animation
  const screenOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(45)).current;
  const logoScale = useRef(new Animated.Value(0.78)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const welcomeTranslateY = useRef(new Animated.Value(18)).current;
  const formTranslateY = useRef(new Animated.Value(25)).current;

  // Decorative background animation
  const orbOne = useRef(new Animated.Value(0)).current;
  const orbTwo = useRef(new Animated.Value(0)).current;

  // Input focus animations
  const usernameFocus = useRef(new Animated.Value(0)).current;
  const passwordFocus = useRef(new Animated.Value(0)).current;

  // Login button press animation
  const loginScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(screenOpacity, {
        toValue: 1,
        duration: 550,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(cardTranslateY, {
        toValue: 0,
        tension: 55,
        friction: 9,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 55,
        friction: 7,
        delay: 150,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 450,
        delay: 120,
        useNativeDriver: true,
      }),
      Animated.timing(welcomeTranslateY, {
        toValue: 0,
        duration: 450,
        delay: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(formTranslateY, {
        toValue: 0,
        duration: 500,
        delay: 330,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // Slow floating background motion.
    Animated.loop(
      Animated.sequence([
        Animated.timing(orbOne, {
          toValue: 1,
          duration: 4200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(orbOne, {
          toValue: 0,
          duration: 4200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(orbTwo, {
          toValue: 1,
          duration: 5200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(orbTwo, {
          toValue: 0,
          duration: 5200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const animateFocus = (animation, focused) => {
    Animated.timing(animation, {
      toValue: focused ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  };

  const pressLogin = () => {
    Animated.sequence([
      Animated.spring(loginScale, {
        toValue: 0.97,
        speed: 30,
        bounciness: 0,
        useNativeDriver: true,
      }),
      Animated.spring(loginScale, {
        toValue: 1,
        speed: 25,
        bounciness: 6,
        useNativeDriver: true,
      }),
    ]).start();

    handleLogin();
  };

  const handleLogin = async () => {
    setError('');

    if (!userName.trim() || !password) {
      setError('Please enter both username and password.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(apiUrl('login'), {
        method: 'POST',
        headers: {
          accept: '*/*',
          'Content-Type': 'application/json-patch+json',
        },
        body: JSON.stringify({
          loginName: userName.trim(),
          password,
        }),
      });

      let data;

      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (res.ok && data?.success) {
        await login(data);
      } else {
        setError(data?.message || 'Invalid credentials.');
      }
    } catch {
      setError(
        'Network error. Please check your connection and API URL, then try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const usernameBorder = usernameFocus.interpolate({
    inputRange: [0, 1],
    outputRange: ['#E4E7EC', '#168AAD'],
  });

  const passwordBorder = passwordFocus.interpolate({
    inputRange: [0, 1],
    outputRange: ['#E4E7EC', '#168AAD'],
  });

  const usernameIconColor = usernameFocus.interpolate({
    inputRange: [0, 1],
    outputRange: ['#98A2B3', '#168AAD'],
  });

  const passwordIconColor = passwordFocus.interpolate({
    inputRange: [0, 1],
    outputRange: ['#98A2B3', '#168AAD'],
  });

  const orbOneTranslate = orbOne.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 28],
  });

  const orbTwoTranslate = orbTwo.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -24],
  });

  return (
    <LinearGradient
      colors={['#101A38', '#153D5B', '#0D6F70']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.root}
    >
      {/* Very subtle animated background shapes.
          No carousel / wallpaper / upper hero panel. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.backgroundOrbOne,
          { transform: [{ translateY: orbOneTranslate }] },
        ]}
      />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.backgroundOrbTwo,
          { transform: [{ translateY: orbTwoTranslate }] },
        ]}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <Animated.View
            style={[
              styles.card,
              {
                opacity: screenOpacity,
                transform: [{ translateY: cardTranslateY }],
              },
            ]}
          >
            {/* HISTree Logo */}
            <Animated.View
              style={[
                styles.logoContainer,
                {
                  opacity: logoOpacity,
                  transform: [{ scale: logoScale }],
                },
              ]}
            >
              <Image
                source={HISTREE_LOGO}
                style={styles.logo}
                resizeMode="contain"
                accessibilityLabel="HISTree logo"
              />
            </Animated.View>

            {/* Welcome text */}
            <Animated.View
              style={{
                opacity: screenOpacity,
                transform: [{ translateY: welcomeTranslateY }],
              }}
            >
              <Text style={styles.welcome}>Welcome Back!</Text>
              <Text style={styles.subWelcome}>
                Please login to get access.
              </Text>
            </Animated.View>

            {/* Form */}
            <Animated.View
              style={{
                opacity: screenOpacity,
                transform: [{ translateY: formTranslateY }],
              }}
            >
              {/* Username */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Username</Text>

                <Animated.View
                  style={[
                    styles.inputWrap,
                    {
                      borderColor: usernameBorder,
                      backgroundColor:
                        focusedField === 'username' ? '#FFFFFF' : '#FAFBFC',
                    },
                  ]}
                >
                  <Animated.View style={{ width: 18 }}>
                    <Feather
                      name="user"
                      size={16}
                      color={
                        focusedField === 'username' ? '#168AAD' : '#98A2B3'
                      }
                    />
                  </Animated.View>

                  <TextInput
                    value={userName}
                    onChangeText={(text) => {
                      setUserName(text);
                      if (error) setError('');
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                    style={styles.input}
                    placeholder="Enter username"
                    placeholderTextColor="#98A2B3"
                    returnKeyType="next"
                    onFocus={() => {
                      setFocusedField('username');
                      animateFocus(usernameFocus, true);
                    }}
                    onBlur={() => {
                      if (focusedField === 'username') setFocusedField('');
                      animateFocus(usernameFocus, false);
                    }}
                  />
                </Animated.View>
              </View>

              {/* Password */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Password</Text>

                <Animated.View
                  style={[
                    styles.inputWrap,
                    {
                      borderColor: passwordBorder,
                      backgroundColor:
                        focusedField === 'password' ? '#FFFFFF' : '#FAFBFC',
                    },
                  ]}
                >
                  <View style={styles.iconBox}>
                    <Feather
                      name="lock"
                      size={16}
                      color={
                        focusedField === 'password' ? '#168AAD' : '#98A2B3'
                      }
                    />
                  </View>

                  <TextInput
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      if (error) setError('');
                    }}
                    secureTextEntry={!showPassword}
                    editable={!loading}
                    style={styles.input}
                    placeholder="Enter password"
                    placeholderTextColor="#98A2B3"
                    returnKeyType="done"
                    onFocus={() => {
                      setFocusedField('password');
                      animateFocus(passwordFocus, true);
                    }}
                    onBlur={() => {
                      if (focusedField === 'password') setFocusedField('');
                      animateFocus(passwordFocus, false);
                    }}
                    onSubmitEditing={pressLogin}
                  />

                  <TouchableOpacity
                    onPress={() => setShowPassword((s) => !s)}
                    hitSlop={10}
                    style={styles.eyeButton}
                    disabled={loading}
                  >
                    <Feather
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={17}
                      color="#98A2B3"
                    />
                  </TouchableOpacity>
                </Animated.View>
              </View>

              {/* Login button */}
              <Animated.View
                style={{
                  transform: [{ scale: loginScale }],
                }}
              >
                <TouchableOpacity
                  onPress={pressLogin}
                  disabled={loading}
                  activeOpacity={0.9}
                  style={[styles.loginBtn, loading && styles.loginBtnLoading]}
                >
                  {loading ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator color="#fff" size="small" />
                      <Text style={styles.loginBtnText}>Signing in...</Text>
                    </View>
                  ) : (
                    <View style={styles.loginContent}>
                      <Text style={styles.loginBtnText}>Login</Text>
                      <Feather name="arrow-right" size={17} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              </Animated.View>

              {/* Error */}
              {!!error && (
                <Animated.View style={styles.errorBox}>
                  <Feather
                    name="alert-circle"
                    size={14}
                    color="#DC2626"
                  />
                  <Text style={styles.errorText}>{error}</Text>
                </Animated.View>
              )}
            </Animated.View>
          </Animated.View>

          <Animated.View style={{ opacity: screenOpacity }}>
            <Text style={styles.footer}>
              Powered by TrioTree Technologies (Pvt.) Ltd. © 2012–2025
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  keyboard: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    minHeight: '100%',
    paddingHorizontal: 18,
    paddingVertical: 28,
    justifyContent: 'center',
  },

  /* Subtle animated background decoration */
  backgroundOrbOne: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(63, 189, 172, 0.10)',
    top: -65,
    right: -55,
  },

  backgroundOrbTwo: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(250, 155, 99, 0.09)',
    bottom: 65,
    left: -70,
  },

  /* Main white login card */
  card: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 22,
    ...shadow.modal,

    // Small glass-like border
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.75)',
  },

  /* Uploaded HISTree logo */
  logoContainer: {
    width: '100%',
    height: 92,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  logo: {
    width: Math.min(SCREEN_W * 0.68, 295),
    height: 97,
  },

  welcome: {
    fontSize: 23,
    fontWeight: '800',
    color: '#172033',
    textAlign: 'center',
    letterSpacing: -0.3,
  },

  subWelcome: {
    fontSize: 12.5,
    color: '#667085',
    textAlign: 'center',
    marginTop: 5,
    marginBottom: 22,
  },

  field: {
    marginBottom: 15,
  },

  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475467',
    marginBottom: 7,
    marginLeft: 3,
  },

  inputWrap: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.2,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: '#FAFBFC',
  },

  iconBox: {
    width: 18,
    alignItems: 'flex-start',
  },

  input: {
    flex: 1,
    fontSize: 14,
    color: '#172033',
    paddingVertical: 0,
    marginLeft: 8,
  },

  eyeButton: {
    width: 28,
    height: 35,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },

  loginBtn: {
    height: 50,
    backgroundColor: '#168AAD',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,

    shadowColor: '#168AAD',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },

  loginBtnLoading: {
    opacity: 0.82,
  },

  loginContent: {
    width: '100%',
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },

  loginBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    marginTop: 13,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },

  errorText: {
    flex: 1,
    color: '#B91C1C',
    fontSize: 11.5,
    lineHeight: 16,
  },

  footer: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 9.5,
    textAlign: 'center',
    marginTop: 18,
  },
});
