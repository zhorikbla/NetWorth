import { Link } from 'react-router-dom'

const FEATURES = [
    {
        icon: '▤',
        title: 'Все операции в одном месте',
        text: 'Записывайте доходы и расходы',
      },
      {
        icon: '▥',
        title: 'Наглядные графики',
        text: 'Сравнивайте поступления и траты',
      },
      {
        icon: '◔',
        title: 'Категории и лимиты',
        text: 'Планируйте расходы по категориям',
      },
]
function AuthPromo() {
  return (
    <div className="register-promo">
      <Link className="register-logo" to="/">
        NetWorth
      </Link>

      <h1>Финансы под контролем</h1>

      <p className="register-promo-description">
        Следите за доходами, расходами и балансом
      </p>

      <div className="register-features">
        {FEATURES.map((feature) => (
          <article className="register-feature" key={feature.title}>
            <span className="register-feature-icon" aria-hidden="true">
              {feature.icon}
            </span>

            <div>
              <h2>{feature.title}</h2>
              <p>{feature.text}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

export default AuthPromo