In previous experiments, we explored fundamental concepts like pathloss and shadowing, which significantly influence wireless system design. In wireless communication, maintaining a minimum level of received power is crucial—for instance, ensuring cellular voice quality remains above a specific threshold. However, pathloss and shadowing introduce attenuation effects that impact received power. To effectively characterize this fading phenomenon, a comprehensive understanding of outage and coverage becomes essential.

<p align="center">
<img src="./Images/exp2.png" width="300">
</p>

## Outage Probability, $P_{out}$
Outage probability is a critical metric in wireless communication systems, representing the likelihood that the received signal power falls below a specified threshold, making the communication link unreliable. In practical terms, it quantifies the probability that a user will experience poor connectivity or dropped calls. Mathematically, it is a function of the target minimum received power, $P_{min}$ (threshold) and the received power at a distance, d, and can be written as

$$
\begin{aligned}
P_{out}\left(d,P_{min}\right) = P\left(P_r(d) < P_{min}\right)
\end{aligned}
$$

## Coverage Area
Coverage area is a fundamental aspect of wireless communication systems, defining the geographical region within which a signal from a transmitter, such as a cellular base station, can be received with good quality. Various factors, including transmission power, antenna characteristics, environmental conditions, and the effects of pathloss and shadowing influence the extent of this area.




In this experiment, we will investigate outage probability to understand its implications on wireless system design. By examining the conditions under which outage occurs, we can identify strategies to enhance coverage and reliability. This analysis will provide valuable insights into optimizing wireless networks to minimize outage probability and ensure consistent performance.
