<script lang="ts">
	import logoWhite from '#lib/design-system/assets/achieve-logo-white-accent.svg';
	import euEmblem from '#lib/design-system/assets/eu-funded-colour-on-dark.png';
	import { href, type Locale } from '#lib/i18n/locales.ts';

	let { locale }: { locale: Locale } = $props();
	const h = (p: string) => href(p, locale);
</script>

<footer class="site-footer">
	<div class="wrap">
		<div class="site-footer__cols">
			<div class="site-footer__brand">
				<img src={logoWhite} alt="ACHIEVE" width="150" height="23" />
				<p class="site-footer__tagline">ACHIEVING HIGH-INTEGRITY VOLUNTARY CLIMATE ACTION</p>
			</div>
			<nav aria-label="Footer">
				<div>
					<h2 id="f-explore">Explore</h2>
					<ul aria-labelledby="f-explore">
						<li><a href={h('/') + '#actors'}>Actor hubs</a></li>
						<li><a href={h('/') + '#principles'}>Integrity principles</a></li>
						<li><a href={h('/') + '#roadmaps'}>Roadmaps</a></li>
						<li><a href={h('/library')}>Library</a></li>
					</ul>
				</div>
				<div>
					<h2 id="f-part">Take part</h2>
					<ul aria-labelledby="f-part">
						<li><a href={h('/have-your-say')}>Have your say</a></li>
						<li><a href={h('/have-your-say/thank-you') + '#join'}>Join the community</a></li>
						<li><a href={h('/about')}>About ACHIEVE</a></li>
					</ul>
				</div>
				<div>
					<h2 id="f-legal">Legal</h2>
					<ul aria-labelledby="f-legal">
						<li><a href={h('/privacy')}>Privacy notice</a></li>
						<li><a href={h('/cookies')}>Cookie notice</a></li>
						<li><a href={h('/accessibility')}>Accessibility statement</a></li>
						<li><a href={h('/legal-notice')}>Legal notice</a></li>
					</ul>
				</div>
			</nav>
		</div>
		<div class="funding">
			<img src={euEmblem} alt="Funded by the European Union" width="215" height="48" />
			<p>
				The ACHIEVE project has received funding from the European Union's Horizon Europe Research and Innovation Programme under grant agreement No
				101137625. Views and opinions expressed are however those of the author(s) only and do not necessarily reflect those of the European Union or CINEA.
				Neither the European Union nor the granting authority can be held responsible for them.
			</p>
		</div>
	</div>
</footer>
