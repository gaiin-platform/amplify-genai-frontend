import React, { useState, useEffect } from 'react';
import { IconStar, IconSparkles, IconRocket, IconCrown, IconBolt, IconShield, IconTrendingUp, IconInfinity, IconDiamond, IconCircleCheck } from '@tabler/icons-react';

interface PricingTier {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  popular?: boolean;
  enterprise?: boolean;
  icon: React.ReactNode;
  buttonText: string;
  buttonVariant: 'primary' | 'secondary' | 'enterprise';
}

const PricingPage: React.FC = () => {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const pricingTiers: PricingTier[] = [
    {
      id: 'starter',
      name: 'Starter',
      price: billingPeriod === 'monthly' ? '$9' : '$90',
      period: billingPeriod === 'monthly' ? '/month' : '/year',
      description: 'Perfect for individuals getting started with AI',
      icon: <IconStar size={24} />,
      buttonText: 'Start Free Trial',
      buttonVariant: 'secondary',
      features: [
        '10,000 tokens per month',
        'Basic chat functionality',
        'Standard response time',
        'Email support',
        'Basic integrations',
        'Mobile app access'
      ]
    },
    {
      id: 'professional',
      name: 'Professional',
      price: billingPeriod === 'monthly' ? '$29' : '$290',
      period: billingPeriod === 'monthly' ? '/month' : '/year',
      description: 'Ideal for professionals and small teams',
      icon: <IconSparkles size={24} />,
      buttonText: 'Get Started',
      buttonVariant: 'primary',
      popular: true,
      features: [
        '100,000 tokens per month',
        'Advanced AI models',
        'Priority response time',
        'Chat & email support',
        'Advanced integrations',
        'Custom assistants',
        'Workflow automation',
        'Analytics dashboard'
      ]
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      description: 'Tailored solutions for large organizations',
      icon: <IconCrown size={24} />,
      buttonText: 'Contact Sales',
      buttonVariant: 'enterprise',
      enterprise: true,
      features: [
        'Unlimited tokens',
        'All premium features',
        'Dedicated support team',
        'Custom integrations',
        'SLA guarantees',
        'Advanced security',
        'Single sign-on (SSO)',
        'Audit logs & compliance',
        'Custom deployment options'
      ]
    }
  ];

  return (
    <div className="pricing-page-container">
      <div className="pricing-page-content">
        {/* Animated Background Elements */}
        <div className="pricing-background-elements">
          <div className="pricing-floating-element pricing-floating-element-1"></div>
          <div className="pricing-floating-element pricing-floating-element-2"></div>
          <div className="pricing-floating-element pricing-floating-element-3"></div>
          <div className="pricing-particle pricing-particle-1"></div>
          <div className="pricing-particle pricing-particle-2"></div>
          <div className="pricing-particle pricing-particle-3"></div>
        </div>

        {/* Header Section */}
        <div className="pricing-header">
          <div className="pricing-header-content">
            <div className="pricing-header-badges">
              <div className="pricing-header-badge">
                <IconBolt size={16} />
                <span>AI-Powered</span>
              </div>
              <div className="pricing-header-badge">
                <IconShield size={16} />
                <span>Enterprise Ready</span>
              </div>
              <div className="pricing-header-badge">
                <IconTrendingUp size={16} />
                <span>Scales with Growth</span>
              </div>
            </div>
            <div className="pricing-header-icon-wrapper">
              <div className="pricing-header-icon">
                <IconRocket size={52} />
              </div>
              <div className="pricing-header-icon-glow"></div>
            </div>
            <h1 className="pricing-header-title">
              <span className="pricing-title-highlight">Choose Your</span>
              <br />
              <span className="pricing-title-main">Perfect Plan</span>
            </h1>
            <p className="pricing-header-subtitle">
              Unlock the unlimited potential of AI with flexible pricing designed to scale
              <br />
              <span className="pricing-subtitle-highlight">with your ambition and success</span>
            </p>
            <div className="pricing-header-stats">
              <div className="pricing-stat">
                <span className="pricing-stat-number">50K+</span>
                <span className="pricing-stat-label">Active Users</span>
              </div>
              <div className="pricing-stat">
                <span className="pricing-stat-number">99.9%</span>
                <span className="pricing-stat-label">Uptime</span>
              </div>
              <div className="pricing-stat">
                <span className="pricing-stat-number">24/7</span>
                <span className="pricing-stat-label">Support</span>
              </div>
            </div>
          </div>
        </div>

        {/* Billing Toggle */}
        <div className="pricing-billing-toggle">
          <div className="pricing-billing-wrapper">
            <div className="pricing-billing-label">
              <IconDiamond size={20} />
              <span>Choose your billing cycle</span>
            </div>
            <div className="pricing-billing-options">
              <button
                className={`pricing-billing-option ${billingPeriod === 'monthly' ? 'pricing-billing-option-active' : ''}`}
                onClick={() => setBillingPeriod('monthly')}
              >
                <span className="pricing-billing-option-text">Monthly</span>
                <span className="pricing-billing-option-desc">Pay as you go</span>
              </button>
              <button
                className={`pricing-billing-option ${billingPeriod === 'yearly' ? 'pricing-billing-option-active' : ''}`}
                onClick={() => setBillingPeriod('yearly')}
              >
                <span className="pricing-billing-option-text">Yearly</span>
                <span className="pricing-billing-option-desc">Best value</span>
                <div className="pricing-billing-badge">
                  <IconSparkles size={12} />
                  <span>Save 20%</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="pricing-cards-container">
          {pricingTiers.map((tier, index) => (
            <div
              key={tier.id}
              className={`pricing-card ${tier.popular ? 'pricing-card-popular' : ''} ${tier.enterprise ? 'pricing-card-enterprise' : ''} ${hoveredCard === tier.id ? 'pricing-card-hovered' : ''}`}
              onMouseEnter={() => setHoveredCard(tier.id)}
              onMouseLeave={() => setHoveredCard(null)}
              style={{
                animationDelay: `${index * 0.2}s`
              }}
            >
              {tier.popular && (
                <div className="pricing-card-badge">
                  <div className="pricing-badge-icon">
                    <IconSparkles size={14} />
                  </div>
                  <span className="pricing-badge-text">Most Popular</span>
                  <div className="pricing-badge-shine"></div>
                </div>
              )}

              {tier.enterprise && (
                <div className="pricing-card-badge pricing-card-badge-enterprise">
                  <div className="pricing-badge-icon">
                    <IconCrown size={14} />
                  </div>
                  <span className="pricing-badge-text">Premium</span>
                  <div className="pricing-badge-shine"></div>
                </div>
              )}

              <div className="pricing-card-content">
                <div className="pricing-card-header">
                  <div className="pricing-card-icon-wrapper">
                    <div className="pricing-card-icon">
                      {tier.icon}
                    </div>
                    <div className="pricing-card-icon-bg"></div>
                  </div>
                  <h3 className="pricing-card-title">{tier.name}</h3>
                  <p className="pricing-card-description">{tier.description}</p>
                </div>

                <div className="pricing-card-price">
                  <div className="pricing-card-price-wrapper">
                    <span className="pricing-card-price-amount">{tier.price}</span>
                    {tier.period && (
                      <span className="pricing-card-price-period">{tier.period}</span>
                    )}
                  </div>
                  {billingPeriod === 'yearly' && tier.price !== 'Custom' && (
                    <div className="pricing-card-savings">
                      <IconTrendingUp size={14} />
                      <span>Save ${(parseInt(tier.price.replace('$', '')) * 12 - parseInt(tier.price.replace('$', '')) * 10)} annually</span>
                    </div>
                  )}
                </div>

                <div className="pricing-card-features">
                  {tier.features.map((feature, featureIndex) => (
                    <div key={featureIndex} className="pricing-card-feature" style={{
                      animationDelay: `${(index * 0.2) + (featureIndex * 0.1)}s`
                    }}>
                      <div className="pricing-card-feature-icon-wrapper">
                        <IconCircleCheck size={18} className="pricing-card-feature-icon" />
                      </div>
                      <span className="pricing-card-feature-text">{feature}</span>
                    </div>
                  ))}
                </div>

                <button
                  className={`pricing-card-button pricing-card-button-${tier.buttonVariant}`}
                >
                  <span className="pricing-button-text">{tier.buttonText}</span>
                  <div className="pricing-button-shine"></div>
                  {tier.popular && <IconSparkles size={16} className="pricing-button-icon" />}
                  {tier.enterprise && <IconInfinity size={16} className="pricing-button-icon" />}
                  {!tier.popular && !tier.enterprise && <IconRocket size={16} className="pricing-button-icon" />}
                </button>
              </div>

              <div className="pricing-card-glow"></div>
            </div>
          ))}
        </div>

        {/* Features Comparison */}
        <div className="pricing-features-section">
          <div className="pricing-features-header">
            <h2 className="pricing-features-title">Feature Comparison</h2>
            <p className="pricing-features-subtitle">
              Compare features across all plans to find the perfect fit
            </p>
          </div>

          <div className="pricing-features-table">
            <div className="pricing-features-table-header">
              <div className="pricing-features-table-cell pricing-features-table-feature-header">Features</div>
              <div className="pricing-features-table-cell">Starter</div>
              <div className="pricing-features-table-cell">Professional</div>
              <div className="pricing-features-table-cell">Enterprise</div>
            </div>

            {[
              { feature: 'Monthly Token Limit', starter: '10K', pro: '100K', enterprise: 'Unlimited' },
              { feature: 'AI Models Access', starter: 'Basic', pro: 'Advanced', enterprise: 'All Models' },
              { feature: 'Response Time', starter: 'Standard', pro: 'Priority', enterprise: 'Instant' },
              { feature: 'Support Level', starter: 'Email', pro: 'Chat & Email', enterprise: 'Dedicated Team' },
              { feature: 'Custom Assistants', starter: '✗', pro: '✓', enterprise: '✓' },
              { feature: 'Workflow Automation', starter: '✗', pro: '✓', enterprise: '✓' },
              { feature: 'Analytics Dashboard', starter: '✗', pro: '✓', enterprise: '✓' },
              { feature: 'SSO Integration', starter: '✗', pro: '✗', enterprise: '✓' },
              { feature: 'Audit Logs', starter: '✗', pro: '✗', enterprise: '✓' }
            ].map((row, index) => (
              <div key={index} className="pricing-features-table-row">
                <div className="pricing-features-table-cell pricing-features-table-feature">{row.feature}</div>
                <div className="pricing-features-table-cell">{row.starter}</div>
                <div className="pricing-features-table-cell">{row.pro}</div>
                <div className="pricing-features-table-cell">{row.enterprise}</div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ Section */}
        <div className="pricing-faq-section">
          <div className="pricing-faq-header">
            <h2 className="pricing-faq-title">Frequently Asked Questions</h2>
          </div>

          <div className="pricing-faq-grid">
            {[
              {
                question: 'Can I change plans at any time?',
                answer: 'Yes, you can upgrade or downgrade your plan at any time. Changes will be reflected in your next billing cycle.'
              },
              {
                question: 'Is there a free trial available?',
                answer: 'Yes, we offer a 14-day free trial for all paid plans. No credit card required to start.'
              },
              {
                question: 'What payment methods do you accept?',
                answer: 'We accept all major credit cards, PayPal, and wire transfers for enterprise customers.'
              },
              {
                question: 'Do you offer refunds?',
                answer: 'Yes, we offer a 30-day money-back guarantee for all plans if you&apos;re not satisfied.'
              }
            ].map((faq, index) => (
              <div key={index} className="pricing-faq-item">
                <h3 className="pricing-faq-question">{faq.question}</h3>
                <p className="pricing-faq-answer">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;