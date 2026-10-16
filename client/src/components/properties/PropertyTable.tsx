import { Building2, ExternalLink } from 'lucide-react'
import { getOperacionColor, getPortalColor } from '@/lib/portals'
import {
  currencyLabel,
  formatDisplayPrice,
  getDisplayPrice,
  type Currency,
} from '@/lib/prices'
import { safeHttpUrl } from '@/lib/url'
import type { Propiedad } from '@/types'

interface PropertyTableProps {
  properties: Propiedad[]
  moneda: Currency
}

export default function PropertyTable({ properties, moneda }: PropertyTableProps) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="table-modern min-w-[860px]">
          <thead>
            <tr>
              <th>Propiedad</th>
              <th>Portal</th>
              <th>Operación</th>
              <th>Precio {currencyLabel(moneda)}</th>
              <th>Distrito</th>
              <th>Dorm.</th>
              <th>Área</th>
              <th className="text-center">Aviso</th>
            </tr>
          </thead>
          <tbody>
            {properties.map(prop => {
              const image = safeHttpUrl(prop.imagen)
              const url = safeHttpUrl(prop.url)
              const price = getDisplayPrice(prop.precio, prop.precio_usd, moneda)
              return (
                <tr key={prop.id}>
                  <td className="max-w-[22rem]">
                    <div className="flex items-center gap-3">
                      {image ? (
                        <img
                          src={image}
                          alt=""
                          className="size-12 shrink-0 rounded-xl object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-surface-3">
                          <Building2 className="size-5 text-text-faint" strokeWidth={1.5} />
                        </span>
                      )}
                      <span className="line-clamp-2 text-sm font-medium text-text">
                        {prop.titulo}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-muted capitalize">
                      <span className="dot" style={{ color: getPortalColor(prop.portal) }} />
                      {prop.portal}
                    </span>
                  </td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        color: getOperacionColor(prop.operacion),
                        borderColor: `${getOperacionColor(prop.operacion)}40`,
                        backgroundColor: `${getOperacionColor(prop.operacion)}1a`,
                      }}
                    >
                      {prop.operacion}
                    </span>
                  </td>
                  <td className="mono whitespace-nowrap font-semibold text-gold">
                    {formatDisplayPrice(price)}
                  </td>
                  <td className="text-text-muted">{prop.distrito}</td>
                  <td className="text-text">{prop.dormitorios}</td>
                  <td className="whitespace-nowrap text-text">{prop.area}</td>
                  <td className="text-center">
                    <a
                      href={url ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Ver aviso: ${prop.titulo}`}
                      aria-disabled={!url}
                      className="btn btn-ghost btn-icon btn-sm text-gold"
                    >
                      <ExternalLink className="size-4" />
                    </a>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
